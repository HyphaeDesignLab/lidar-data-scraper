import axios from "axios";
import config from './config.js';

const ApiCache = {};
if (!config.api.script) {
  throw new Error('missing api script');
}

class Api {
  // setters from React components when an api responses arrives,

  //  loading: react app might want to update UI when API is loading/not
  #loadingSetter = () => {};

  //  loading text: react app might want to update what text the loader says
  #loadingTextSetter = () => {};

  //  auth user: api response is standard and always contains the current auth user if logged in
  //             hence set the use if use is
  #authUserSetter = () => {};
  //   track last auth user, so we can check if auth user has changed,
  //   so that we don't necessarily trigger updates in react app
  #currentAuthUser = null;
  #lastAuthUser = null;

  // allows API to set the server error to the App "world"
  #serverErrorSetter = () => {};


  setLoadingSetter(setter) {
    this.#loadingSetter = setter;
  }

  setLoadingTextSetter(setter) {
    this.#loadingTextSetter = setter;
  }
  setLoadingText(text) {
    this.#loadingTextSetter(text);
  }
  setLoading(toState) {
    this.#loadingSetter(toState);
  }

  setAuthUserSetter(setter) {
    this.#authUserSetter = setter;
  }

  setServerErrorSetter(setter) {
    this.#serverErrorSetter = setter;
  }

  ping() {
    return this.run('ping');
  }

  run(cmd, data = null, useCache = false) {
    const apiInvokeFn = (cmd, dataEncoded) => {
      return axios({
        method: 'POST',
        url: (config.api.script.base || '') + '/' + config.api.script.replace(/^\/+/, '').replace('{cmd}', cmd),
        data: dataEncoded,
        headers: {
          'content-type': dataEncoded instanceof FormData ? 'multipart/form-data' : 'application/x-www-form-urlencoded',
        },
      })
    }
    return this.runInternal(apiInvokeFn, cmd, data, useCache);
  }

  simulateRun(cmd, data = null, useCache = false, sampleResponse) {
    const apiInvokeFn = () => {
      return Promise.resolve({data: sampleResponse});
    }
    return this.runInternal(apiInvokeFn, cmd, data, useCache);
  }

  runInternal(apiInvokeFn, cmd, data = null, useCache = false) {
    if (!cmd.match(/^[a-z0-9\-\/]+$/)) {
      return Promise.reject('bad command');
    }
    let dataEncoded = null;
    let dataAsFormData = null;
    let hasFile = false;
    if (data) {
      dataEncoded = Object.keys(data).map(k => {
        if (data[k] instanceof File) {
          hasFile = true;
        } if (data[k] instanceof Array) {
          if (data[k].length) {
            return data[k].map(v => encodeURIComponent(k) + '[]=' + encodeURIComponent(v)).join('&');
          } else {
            // still send the empty array if so intended by component
            return encodeURIComponent(k)+'=';
          }
        }
        return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
      }).join('&');

      if (hasFile) {
        dataAsFormData = new FormData();
        Object.keys(data).forEach(k => {
          if (data[k] instanceof File) {
            dataAsFormData.append(k, data[k], data[k].name);
            //dataAsFormData.append('fileName', data[k].name);
          } else if (data[k] instanceof Array) {
            if (data[k].length) {
              data[k].forEach(v => dataAsFormData.append(`${k}[]`, v));
            } else {
              // still send the empty array if so intended by component
              dataAsFormData.append(k, '');
            }
          } else {
            dataAsFormData.append(k, data[k]);
          }
        });
      }
    }

    //console.log('api call: ' + cmd);
    if (useCache) {
      if (ApiCache[cmd + '::' + dataEncoded]) {
        //console.log('api call from cache');
        return Promise.resolve(ApiCache[cmd + '::' + dataEncoded]);
      }
    } else {
      delete ApiCache[cmd + '::' + dataEncoded];
    }
    //console.log('api call fresh from SERVER');

    // only set loading ON after checking cache and other QUICK pre-api code
    // (it doesn't make sense to turn loading on/off for too brief of actions)
    this.#loadingSetter(true);
    this.#serverErrorSetter(null);

    return apiInvokeFn(cmd, hasFile ? dataAsFormData : dataEncoded)
      .then(response => {
        // if somehow API sent 200 status code even though there are app/api errors
        if (response.data.status==='error') {
          return Promise.reject(response); // pass the response as an error down the promise chain
        }
        if (useCache) {
          ApiCache[cmd + '::' + dataEncoded] = response.data;
        }
        // save auth user
        this.#currentAuthUser = response.data.user ? {...response.data.user} : null;
        return response.data;
      })
      .catch(error => {
        if (useCache) {
          delete ApiCache[cmd + '::' + dataEncoded];
        }

        // The request error came from an intentional API condition (not a bug or code/unforseen condition)
        if (error.data) {
          // save auth user
          this.#currentAuthUser = error.data.user ? {...error.data.user} : null;
          this.#serverErrorSetter({title: 'Could not complete ' + error.data.path, text: error.data.error});
          // pass the error onto other App components
          return Promise.reject(error.data);
        }

        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        else if (error.response) {
          // if it contains "data" and "path" then it is likely API response
          if (error.response.data && error.response.path) {
            this.#serverErrorSetter({title: 'Could not complete ' + error.data.path, text: error.message});
            return Promise.reject(error.data); // pass it on to other App components
          } else {
            this.#serverErrorSetter({title: 'Could not complete', text: error.message});
          }
        }

        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        else if (error.request) {
          this.#serverErrorSetter({title: 'Network/Server Error', text: '(e.g. internet is down, or the server crashed); '+error.message});

        // Something happened in setting up the request that triggered an Error
        } else {
          this.#serverErrorSetter({title: 'Cannot send action/request', text: error.message});
        }

        return Promise.reject(error.message); // pass it on to other App components
      })
      .finally(() => {
        this.#loadingSetter(false);

        // if a change occurred to auth user
        //   either user does not match (empty to not-empty or vice-versa)
        //   OR user ID's don't match
        if ((this.#currentAuthUser ? this.#currentAuthUser.id : null) !== (this.#lastAuthUser ? this.#lastAuthUser.id : null)) {
          this.#authUserSetter(this.#currentAuthUser);
          this.#lastAuthUser = this.#currentAuthUser;
        }
      });
  }
}

let apiInstance;
export default apiInstance = new Api();
