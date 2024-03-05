function LidarScraperMap() {
    const USGS_URL_BASE = 'https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects'
    const USGS_FILE_PREFIX = 'USGS_LPC_'
    if (LidarScraperMap.__IS_INIT) {
        return;
    }
    LidarScraperMap.__IS_INIT = true

    if (window.location.search.indexOf('map=fake') > 0) {
        window.mapboxgl = FakeMapboxglMap;
        window.MapboxDraw = FakeMapboxDraw;
    }
    const log = window.location.search.indexOf('debug=') < 0 ? () => {
    } : (...things) => {
        things.forEach(thing => {
            console.log(thing)
        });
    };

    window.map = null

    function initMap() {
        mapboxgl.accessToken = 'pk.eyJ1IjoiaHlwaGFlLWxhYiIsImEiOiJjazN4czF2M2swZmhkM25vMnd2MXZrYm11In0.LS_KIw8THi2qIethuAf2mw';

        let customCenter = null;
        let customZoom = null;
        if (window.location.search) {
            const customCenterMatch = window.location.search.match(/center=([^&]+)/);
            const customZoomMatch = window.location.search.match(/zoom=([^&]+)/)
            if (customCenterMatch) {
                customCenter = customCenterMatch[1].split(',').map(i => parseFloat(i));
            }
            if (customZoomMatch) {
                customZoom = parseInt(customZoomMatch[1])
            }
        }
        if (!customCenter || !customZoom) {
            let customCenterZoomFromLocalStorage = localStorage.getItem('lidar-scraper:zoom-center');
            if (customCenterZoomFromLocalStorage) {
                customCenterZoomFromLocalStorage = JSON.parse(customCenterZoomFromLocalStorage);
                if (!customCenter) {
                    customCenter = customCenterZoomFromLocalStorage.center;
                }
                if (!customZoom) {
                    customZoom = customCenterZoomFromLocalStorage.zoom;
                }
            }
        }
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/hyphae-lab/clb2h2e48000015o4w0b0tyig',
            center: customCenter ?? [-121.87209750161911, 41.648412869824384],
            zoom: customZoom ?? 6.5
        });
        map.on('moveend', function saveZoom() {
            localStorage.setItem('lidar-scraper:zoom-center', JSON.stringify({
                center: map.getCenter(),
                zoom: map.getZoom()
            }))
        })
    }


    let layersToQuery = ['projects', 'tiles'];
    const mapSources = {highlight: null, projects: null, tiles: null}
    const mapData = {};

    function initData() {
        let customDataFile = null;
        if (window.location.search) {
            const customDataFileMatch = window.location.search.match(/data=([^&]+)/)
            if (customDataFileMatch) {
                customDataFile = customDataFileMatch[1]
            }
        }
        const dataFile = customDataFile ? customDataFile : 'projects/map_tiles.json'
        fetch(dataFile)
            .then(response => response.json())
            .then(data => loadProjectsData(data));

        renderSavedAoiControls(); // after all is done and loaded

        map.on('styledata', e => {
            HygeoLoadingSpinnerEl.INSTANCE.stop();
        });
    }

    const allProjectsFillColorForMode = {
        'projects': ["case",
            ['==', ['get', 'leaves'], 'on'], ["rgba", 90, 255, 112, .5], // "#5aff70",
            ['==', ['get', 'leaves'], 'off'], ["rgba", 252, 174, 81, .5], // "#fcae51"
            ["rgba", 252, 81, 121, .5] // "#fc5179"
        ],
        'tiles': ["case",
            ['==', ['get', 'leaves'], 'on'], ["rgba", 90, 255, 112, .2], // "#5aff70",
            ['==', ['get', 'leaves'], 'off'], ["rgba", 252, 174, 81, .2], // "#fcae51"
            ["rgba", 252, 81, 121, .2] // "#fc5179"
        ]
    }

    function loadProjectsData(data) {
        mapData.projects = data;
        log(data)

        data.features.forEach((feature, i) => {
            addProjectControlEl(feature.properties.project)
            feature.properties.is_project = true;
            if (!feature.id) {
                feature.id = (i + 1);
            }
        })

        map.addSource('highlight', {
            type: 'geojson',
            data: {type: 'FeatureCollection', features: []}
        });
        map.addLayer({
            'id': 'highlight',
            'type': 'line',
            'source': 'highlight',
            "paint": {
                "line-color": 'black',
                "line-width": 2
            }
        });
        mapSources.highlight = map.getSource('highlight')

        map.addSource('projects', {type: 'geojson', data});

        mapSources.projects = map.getSource('projects')
        map.addLayer({
            'id': 'projects',
            'type': 'fill',
            'source': 'projects',
            "paint": {
                "fill-color": allProjectsFillColorForMode.projects,
                "fill-opacity": .8, // default
                "fill-outline-color": ['case',
                    ['==', ['feature-state', 'focused'], true], "#222222",
                    ['==', ['get', 'leaves'], 'on'], "#047e16",
                    "#a94202"
                ]
            }
        });

        map.addSource('tiles', {
            type: 'geojson',
            data: {type: 'FeatureCollection', features: []}
        });
        mapSources.tiles = map.getSource('tiles')
        map.addLayer({
            'id': 'tiles',
            'type': 'fill',
            'source': 'tiles',
            "paint": {
                "fill-color": ["case",
                    ['==', ['get', 'leaves'], 'on'], ["rgba", 90, 255, 112, .5], // "#5aff70",
                    ['==', ['get', 'leaves'], 'off'], ["rgba", 252, 174, 81, .5], // "#fcae51"
                    ["rgba", 252, 81, 121, .5] // "#fc5179"
                ],
                "fill-opacity": .8, // default
                "fill-outline-color": ['case',
                    ['==', ['feature-state', 'focused'], true], "#222222",
                    ['==', ['get', 'leaves'], 'on'], "#047e16",
                    "#a94202"
                ]
            }
        });
        // map.addLayer({
        //     'id': 'tiles',
        //     'type': 'fill',
        //     'source': 'tiles',
        //     "paint": {
        //         "fill-color": "#aaaaff",
        //         "fill-opacity": .9,
        //         "fill-outline-color": "#0000aa"
        //     }
        // });

        toggleMapClick(true);
    }

    function loadTilesData(projectFeature, immediatelyDisplayLoadedData = true) {
        const project = projectFeature.properties.project;
        const parentFeatureId = parseInt(projectFeature.id);
        const loadData_ = () => {
            if (immediatelyDisplayLoadedData) {
                mapSources.tiles.setData(mapData[project]); // update
            }
            setClickMode('tiles')
        }
        if (mapData[project]) {
            // no need to run loading/spinner as data is already loaded
            loadData_()
            return Promise.resolve();
        } else {
            // if the call was made to display immediately (i.e. not in a group/batch call),
            //    show the loading/spinner (else the spinner was started elsewhere by parent/caller)
            if (immediatelyDisplayLoadedData) {
                HygeoLoadingSpinnerEl.INSTANCE.start();
            }
            return fetch(`projects/${project}/map_tiles.json`)
                .then(response => response.json())
                .then(data => {
                    if (!data.features[0].id) {
                        const baseNumber = parentFeatureId * Math.pow(10, String(data.features.length).length)
                        data.features.forEach((feature, i) => {
                            feature.id = baseNumber + (i + 1);
                        })
                    }
                    data.features.forEach(feature => {
                        // fill in missing pieces that do not need to be transferred via WEB
                        feature.properties.project = project
                        feature.properties.laz_url_dir = projectFeature.properties.laz_url_dir;
                    })

                    // update source
                    mapData[project] = data;
                    loadData_()
                })
        }

    }

    let clickMode = 'projects'

    function setClickMode(mode) {
        clickMode = mode;
        switch (mode) {
            case 'projects':
                map.setPaintProperty('projects', 'fill-color', allProjectsFillColorForMode.projects);
                break;
            case 'tiles':
                map.setPaintProperty('tiles', 'fill-color', allProjectsFillColorForMode.tiles);
                break;
        }
    }

    function toggleMapClick(newState) {
        if (newState) {
            map.on('click', onMapClick);
        } else {
            map.off('click', onMapClick);
        }
    }

    function onMapClick(clickEvent) {
        log(clickEvent);
        let features = map.queryRenderedFeatures(clickEvent.point, {layers: layersToQuery});
        log(features);

        if (!features.length) {
            mapSources.highlight.setData({type: 'FeatureCollection', features: []});
            return;
        }

        const tileFeatures = features.filter(f => !f.properties.is_project);
        if (features.length > 1) {
            if (clickMode === 'tiles' && !!tileFeatures.length) {
                // if in "PROJECT" mode,
                // only show the project tile features (skip the project Bbox)
                features = tileFeatures;
                if (features.length > 1) {
                    renderMultiLayerChooser(features, clickEvent.lngLat);
                    return;
                }
                // else continue to logic for feature.length === 0 below
            } else {
                renderMultiLayerChooser(features, clickEvent.lngLat)
                return;
            }
        }

        const feature = features[0];
        // weird behavior of mapbox selecting partial complex polygon returned by queryRenderedFeatures() at various zoom levels
        // const feature = features[0].properties.type === 'projects' ? mapData.projects.features.find(f => f.id === features[0].id) : features[0];
        mapSources.highlight.setData({type: 'FeatureCollection', features: [feature]});
        log(feature)
        renderPopup(feature, clickEvent.lngLat)
    }

    function renderMultiLayerChooser(features, mapClickEventLngLat) {
        const listEl = document.createElement('ul');
        listEl.style.padding = '0';
        const headingEl = document.createElement('div');
        headingEl.innerText = 'choose a layer to view details:'
        listEl.appendChild(headingEl)
        let popup = null
        features.forEach(feature => {
            const projectName = feature.properties.project.replace('/', ': ').replaceAll('_', ' ');
            const name = !feature.properties.is_project ?
                `tile ${feature.id} (${projectName})`
                : `project ${projectName} with ${feature.properties.tile_count} tiles`;
            const el = document.createElement('li');
            el.style.cursor = 'pointer'
            el.style.textDecoration = 'underline'
            el.style.margin = '0'
            el.style.marginLeft = '10px'
            el.innerText = name;
            el.addEventListener('click', e => {
                popup.remove();
                onMultiLayerChooserClick(feature, mapClickEventLngLat)
            })
            listEl.appendChild(el);
        })
        popup = initPopupObject(listEl, mapClickEventLngLat);
    }

    function onMultiLayerChooserClick(feature, mapClickEventLngLat) {
        // if feature selected is a project tile (i.e. NOT a project bbox)
        //   then switch to 'project' mode
        if (!feature.properties.is_project) {
            setClickMode('tiles')
        }
        mapSources.highlight.setData({type: 'FeatureCollection', features: [feature]});
        renderPopup(feature, mapClickEventLngLat)
    }

    function renderPopup(feature, mapClickLngLat) {
        const dateStart = feature.properties.date_start.replace(/^(\d{4})(\d\d)(\d\d).*/, '$1-$2-$3')
        const timeStart = feature.properties.date_start.length > 4+2+2 ? feature.properties.date_start.substring(4+2+2).replace(/^(\d\d)(\d\d)(\d\d)?/, '$1:$2:$3') : '';
        const dateEnd = feature.properties.date_end.replace(/^(\d{4})(\d\d)(\d\d).*/, '$1-$2-$3');
        const timeEnd = feature.properties.date_end.length > 4+2+2 ? feature.properties.date_end.substring(4+2+2).replace(/^(\d\d)(\d\d)(\d\d)?/, '$1:$2:$3') : '';
        const leavesStatus = feature.properties.leaves.toUpperCase();
        const projectName = feature.properties.project.replace('/', ': ').replaceAll('_', ' ');
        const tileCount = feature.properties.tile_count;

        // if the feature clicked on to show popup for is the "project" feature/polygon (not the individual tile within a project)
        const isProjectFeature = feature.properties.is_project;
        setClickMode(isProjectFeature ? 'projects': 'tiles');
        let clickHandlers = null;
        let html = '';

        // PROJECT FEATURE
        if (isProjectFeature) {
            html = `
<div><strong>PROJECT: <br/></strong> ${projectName}</div>
<div>
    leaves are ${leavesStatus}<br/>
    from ${dateStart} to ${dateEnd}<br/>
    ${tileCount} tiles
    <br/>
    <div>
    <div data-load-more-tiles="error" style="color: red; display: none"></div>
    <span data-load-more-tiles="loading" style="display: none">loading tiles...</span>
    <a href="#" data-load-more-tiles="start">see tiles</a>
    </div>
</div>
`;
            clickHandlers = () => {
                addProjectPopupClickHandlers(feature)
            };
        }
        // TILE FEATURE
        else {
            const tileId = getLazTileId(feature) || 'n/a';
            let lazTileLink = '';
            if (feature.properties.laz_tile) {
                const lazSize = feature.properties.laz_size;
                const lazUrl = makeLazUrl(feature);
                lazTileLink = `<a href="${lazUrl}" target="_blank">download LAZ tile (${lazSize})</a>`
            }

            html = `
<div><strong>Project TILE (${tileId} #${feature.id}): <br/></strong> (${projectName})</div>
<div>
    leaves are ${leavesStatus}<br/>
    from ${dateStart} ${timeStart} to ${dateEnd} ${timeEnd}<br/>
    <br/>
    <div>
        <div data-load-more-tiles="error" style="color: red; display: none"></div>
        <span data-load-more-tiles="loading" style="display: none">downloading tiles...</span>
        ${lazTileLink}
    </div>
</div>
`;
        }
        initPopupObject(html, mapClickLngLat, clickHandlers);
    }

    function addProjectPopupClickHandlers(projectFeature) {
        const loadTilesEl = document.querySelector('[data-load-more-tiles=start]');
        const loadTilesErrorEl = document.querySelector('[data-load-more-tiles=error]');
        const loadingTilesEl = document.querySelector('[data-load-more-tiles=loading]');
        loadTilesEl.addEventListener('click', e => {
            if (loadTilesEl.isClicked) {
                return; // clicked already, prevent double clicking
            }
            loadTilesEl.isClicked = true;
            e.preventDefault();
            e.stopPropagation();
            loadingTilesEl.style.display = '';
            loadTilesEl.style.display = 'none';
            loadTilesErrorEl.innerText = '';
            loadTilesErrorEl.style.display = 'none';

            setTimeout(() => {
                loadTilesData(projectFeature)
                    .then(() => {
                        loadTilesEl.isClicked = false;
                        loadTilesEl.style.display = 'none';
                        loadingTilesEl.style.display = 'none'
                        loadTilesErrorEl.style.display = 'none'
                    })
                    .catch(e => {
                        loadTilesEl.isClicked = false;
                        loadTilesErrorEl.style.display = ''
                        loadTilesErrorEl.innerText = e.message
                        loadingTilesEl.style.display = 'none'
                        loadTilesEl.style.display = ''
                    });
            }, 1)
        })
    }

    let lastPopup;

    function initPopupObject(htmlOrEl, popupLngLat, onOpenCallback) {
        const popupOffsets = {
            'top': [0, 10],
            'top-left': [10, 10],
            'top-right': [-10, 10],
            'bottom': [0, -10],
            'bottom-left': [10, -10],
            'bottom-right': [-10,-10],
            'left': [10, 0],
            'right': [-10, 0]
        };
        /*
        {
            'top': [0, 0],
            'top-left': [0, 0],
            'top-right': [0, 0],
            'bottom': [0, -50],
            'bottom-left': [25, (65) * -1],
            'bottom-right': [-25, (65) * -1],
            'left': [10, (40) * -1],
            'right': [-10, (40) * -1]
        }
        */
        if (lastPopup) {
            lastPopup.setHTML(''); // reset
        }
        lastPopup = new mapboxgl.Popup({
            offset: popupOffsets,
            className: 'transparent-popup',
            closeOnClick: true,
            closeOnMove: false
        })
            .setLngLat(popupLngLat)
            .setMaxWidth("300px");
        if (htmlOrEl instanceof Object) {
            lastPopup.setDOMContent(htmlOrEl)
        } else {
            lastPopup.setHTML(htmlOrEl)
        }
        if (onOpenCallback) {
            lastPopup.on('open', onOpenCallback);
        }
        lastPopup.addTo(map);
        return lastPopup
    }


    const renderedElements = {};
    const controlsEl = document.querySelector('[data-controls=container]');
    controlsEl.toggleEl = document.querySelector('[data-controls=toggle]')
    controlsEl.contentEl = document.querySelector('[data-controls=content]')
    controlsEl.toggleEl.addEventListener('click', e => {
        if (!controlsEl.contentEl.style.display) {
            controlsEl.contentEl.style.display = 'none';
            controlsEl.style.minWidth = 'auto'
        } else {
            controlsEl.contentEl.style.display = ''
            controlsEl.style.minWidth = controlsEl.dataset.styleMinWidth
        }
    });

    function addProjectControlEl(project) {
        //renderProjectControlEl(project)
    }

    function renderProjectControlEl(project) {
        const el = document.createElement('div')
        el.innerHTML = `<div>${project}</div>`
        controlsEl.contentEl.appendChild(el);
    }

    function addControlEl(el, parentEl = null) {
        (parentEl ? parentEl : controlsEl.contentEl).appendChild(el);
    }


    // ------------------- Area of Interest Intersection Tools -------------------
    const newAoiControlTemplateEl = document.querySelector('[data-controls=add-area-of-interest]');
    newAoiControlTemplateEl.parentElement.removeChild(newAoiControlTemplateEl);
    const initNewAoiControl = () => {
        const setAoiData = featureCollection => {
            if (featureCollection) {
                mapSources.highlight.setData(featureCollection);
                initAoiControl(featureCollection)
            } else {
                mapSources.highlight.setData({type: "FeatureCollection", features: []});
            }
            updateMethodLinksAndContainers();
        }

        const el = newAoiControlTemplateEl.cloneNode(true);

        const methodLinks = el.querySelectorAll('[data-aoi-method-link]');
        const methodContainers = el.querySelectorAll('[data-aoi-method]');
        const updateMethodLinksAndContainers = (activeType = false) => {
            methodLinks.forEach(el => el.style.background = el.dataset.aoiMethodLink === activeType ? 'lightgrey' : 'unset');
            methodContainers.forEach(el => {
                el.style.display = el.dataset.aoiMethod === activeType ? '' : 'none';
                if (activeType !== 'draw' && el.dataset.aoiMethod === 'draw') {
                    !!drawCancel && drawCancel();
                }
            });
        }

        methodLinks.forEach(el => {
            el.addEventListener('click', e => {
                updateMethodLinksAndContainers(el.dataset.aoiMethodLink)
                e.preventDefault();
                return false;
            })
        })

        const drawStartBtn = el.querySelector('[data-aoi-method="draw"] [data-aoi-draw=start]');
        const drawStopBtn = el.querySelector('[data-aoi-method="draw"] [data-aoi-draw=stop]');
        const drawCancelBtn = el.querySelector('[data-aoi-method="draw"] [data-aoi-draw=cancel]');

        drawStopBtn.style.display = 'none';
        drawCancelBtn.style.display = 'none';

        let drawState = false;
        let mapboxDrawObj = false;
        const drawStart = e => {
            if (drawState) {
                return;
            }
            drawState = true;
            toggleMapClick(!drawState); // invert-set map click when in "draw on map" mode

            drawStartBtn.style.display = 'none';
            drawStopBtn.style.display = '';
            drawCancelBtn.style.display = '';

            if (!mapboxDrawObj) {
                mapboxDrawObj = new MapboxDraw({
                    displayControlsDefault: false,
                    controls: {
                        polygon: true,
                        trash: true
                    }
                    // styles: MapboxDrawDefaultTheme
                });
                mapboxDrawObj.onAdd(map);
                //map.addControl(drawBtn.mapboxDrawObj, 'top-right');
            }
            mapboxDrawObj.changeMode('draw_polygon')
        };
        drawStartBtn.addEventListener('click', drawStart);

        const drawStop = e => {
            if (!drawState) {
                return;
            }
            drawState = false;
            toggleMapClick(!drawState); // invert-set map click when in "draw on map" mode

            drawStartBtn.style.display = '';
            drawStopBtn.style.display = 'none';
            drawCancelBtn.style.display = 'none';

            const featureCollection = mapboxDrawObj.getAll();
            mapboxDrawObj.changeMode('simple_select')
            mapboxDrawObj.deleteAll();
            setAoiData(featureCollection);
        };
        drawStopBtn.addEventListener('click', drawStop);

        const drawCancel = e => {
            if (!drawState) {
                return;
            }
            drawState = false;
            toggleMapClick(!drawState); // invert-set map click when in "draw on map" mode

            drawStartBtn.style.display = '';
            drawStopBtn.style.display = 'none';
            drawCancelBtn.style.display = 'none';

            mapboxDrawObj.changeMode('simple_select')
            mapboxDrawObj.deleteAll();
            setAoiData(null);
        };
        drawCancelBtn.addEventListener('click', drawCancel);

        updateMethodLinksAndContainers();

        const fileEl = el.querySelector('[data-aoi-method="file"] input');
        fileEl.addEventListener('change', e => {
            var reader = new FileReader();
            reader.readAsText(fileEl.files[0], 'UTF-8');
            reader.onload = function (e) {
                setAoiData(JSON.parse(e.target.result));
            }
        })

        const manualTextEl = el.querySelector('[data-aoi-method="manual"] textarea');
        const manualTextAddEl = el.querySelector('[data-aoi-method="manual"] button');
        manualTextAddEl.addEventListener('click', e => {
            setAoiData(JSON.parse(manualTextEl.value));
        })

        addControlEl(el);
    }

    const aoiContainerControlTemplateEl = document.querySelector('[data-controls=area-of-interest-container]');
    aoiContainerControlTemplateEl.parentElement.removeChild(aoiContainerControlTemplateEl);
    const initAoiContainerControl = () => {
        const el = renderedElements.aoiContainer = aoiContainerControlTemplateEl.cloneNode(true);
        addControlEl(el)
    };

    const aoiControlTemplateEl = document.querySelector('[data-controls=area-of-interest]');
    aoiControlTemplateEl.parentElement.removeChild(aoiControlTemplateEl);
    const initAoiControl = (data, name='', id=null) => {
        let aoiName = name || `New area of interest ${String(new Date()).substring(0, 21)}`;
        let aoiId = id;
        if (!aoiId) {
            aoiId = new Date().getTime();
            const savedAoiIds = localStorage.getItem('lidar-scraper:aoi-list');
            localStorage.setItem('lidar-scraper:aoi-list', (savedAoiIds ? savedAoiIds+';':'') + aoiId);
            localStorage.setItem(`lidar-scraper:aoi:${aoiId}`,JSON.stringify({
                name: aoiName,
                data: data
            }));
        }

        switch (data.type) {
            case 'FeatureCollection':
                data = data.features[0].geometry
                break;
            case 'Feature':
                data = data.geometry
                break;
            case 'GeometryCollection':
                data = data.geometries[0]
                break;
        }
        let aoiPolygonTurf;
        let aoiPolygonType;
        let aoiPolygonSimpleTurf;
        switch (data.type) {
            case 'Polygon':
                aoiPolygonType = 'polygon';
                aoiPolygonTurf = turf.polygon(data.coordinates);
                aoiPolygonSimpleTurf = turf.polygon([data.coordinates[0]]); // outer ring
                break;
            case 'MultiPolygon':
                aoiPolygonType = 'multipolygon';
                aoiPolygonTurf = turf.multiPolygon(data.coordinates);
                aoiPolygonSimpleTurf = turf.polygon([data.coordinates[0][0]]); // first polygon outerring
                break;
            default:
                // assume outer polygon ring coordinates [ [x,y], [x2,y2], ... ]
                aoiPolygonType = 'polygon';
                aoiPolygonTurf = turf.polygon([data]);
                aoiPolygonSimpleTurf = turf.polygon([data]);
        }
        // simplify polygon/multi-polygon selections: they can be extraordinarily complex without a real need. and make intesections client-side
        if (aoiPolygonTurf) {
            aoiPolygonTurf = turf.simplify(aoiPolygonTurf, {tolerance: 0.0001, highQuality: false});
        }

        const el = aoiControlTemplateEl.cloneNode(true);
        const nameEl = el.querySelector('[data-name]')
        const nameEditEl = el.querySelector('[data-name-edit]')
        nameEl.innerText = aoiName;
        nameEditEl.addEventListener('click', e => {
            nameEl._isContentEditable = !nameEl._isContentEditable; // custom property boolean
            nameEl.contentEditable = nameEl._isContentEditable; // string proper DOM property; assignment will cast boolean to string
            nameEditEl.innerHTML = nameEl._isContentEditable ? 'save' : '&#x270e;';
            if (nameEl._isContentEditable) {
                nameEl.focus();
            } else {
                nameEditEl.focus();
                if (nameEl.innerText !== aoiName) {
                    aoiName = nameEl.innerText;
                    localStorage.setItem(`lidar-scraper:aoi:${aoiId}`,JSON.stringify({
                        name: aoiName,
                        data: data
                    }));
                }
            }
        });

        el.detailsEl = el.querySelector('[data-details]')
        el.detailsEl.style.overflow = 'overflow';
        const detailsElHeightTransitionSpeedMs = 250;
        el.detailsEl.style.transition = `height ${detailsElHeightTransitionSpeedMs}ms ease-in`;
        const toggleDetailsEl = (el, state, noAnimation) => {
            if (noAnimation) {
                el.style.height = state ? '200px' : '0';
                return;
            }
            if (state) {
                el.style.height = 0;
                setTimeout(() => {
                    el.style.height = '200px';
                    setTimeout(() => {
                        el.style.height = 'auto';
                    }, detailsElHeightTransitionSpeedMs * 2);
                }, 1)
            } else {
                el.style.height = '200px';
                setTimeout(() => {
                    el.style.height = '0';
                }, 1)
            }
        }
        el.detailsToggleEl = el.querySelector('[data-details-toggle]')
        el.detailsToggleEl.style.display = 'none';
        const intersectBtn = el.querySelector('button[data-button="intersect"]')
        const selectedProjectsStatsEl = el.querySelector('[data-selected-projects-stats]')
        const bbox = turf.bbox(aoiPolygonTurf);
        const center = turf.center(aoiPolygonTurf);
        const canvasStyle = getComputedStyle(map.getCanvas());

        const intersectingProjectsTotals = {tileCount: 0, tileCountMissingLaz: 0, tileSize: 0}
        const intersectingProjects = {};
        const findIntersection = () => {
            HygeoLoadingSpinnerEl.INSTANCE.start();

            setCenterAndZoom();

            intersectBtn.disabled = true;


            const loadDataPromises = [];
            mapData.projects.features.forEach(feature => {
                const turfProjectPoly = turf[typeof (feature.geometry.coordinates[0][0][0]) === 'number' ? 'polygon' : 'multiPolygon'](feature.geometry.coordinates, feature.properties)
                if (turf.booleanIntersects(aoiPolygonTurf, turfProjectPoly)) {
                    intersectingProjects[feature.properties.project] = {
                        project: feature.properties,
                        tileCountMissingLaz: 0,
                        tileSize: 0,
                        tileCount: 0,
                        selected: {on: true, off: true, mixed: true}, // or false
                        tiles: []
                    };
                    const loadPromise = loadTilesData(feature, false);
                    loadDataPromises.push(loadPromise);
                }
            })
            Promise.all(loadDataPromises).then(() => {
                Object.keys(intersectingProjects).forEach(projectId => {
                    if (!mapData[projectId] || !mapData[projectId].features || !mapData[projectId].features.length) {
                        delete intersectingProjects[projectId];
                        return;
                    }
                    mapData[projectId].features.forEach(feature => {
                        const turfProjectTilePoly = turf.polygon(feature.geometry.coordinates, feature.properties)
                        if (turf.booleanIntersects(aoiPolygonTurf, turfProjectTilePoly)) {
                            intersectingProjects[projectId].tiles.push(feature);

                            // Set the original totals of the project tiles
                            intersectingProjectsTotals.tileCount++;
                            intersectingProjects[projectId].tileCount++;
                            if (!feature.properties.laz_tile) {
                                intersectingProjectsTotals.tileCountMissingLaz++;
                                intersectingProjects[projectId].tileCountMissingLaz++;
                            } else {
                                if (feature.properties.laz_size) {
                                    feature.properties.laz_size_number = parseLazSize(feature.properties.laz_size);
                                    intersectingProjectsTotals.tileSize += feature.properties.laz_size_number;
                                    intersectingProjects[projectId].tileSize += feature.properties.laz_size_number;
                                }
                            }
                        }
                    });
                });

                addAoiProjectsControls();
                addAoiGeojsonControls();
                addAoiButtonHandlers();
                hightlightIntersectionTiles();
                updateSelectedStats();

                intersectBtn.style.display = 'none';
                el.isActive = true;
                toggleDetailsEl(el.detailsEl, true)
                el.detailsToggleEl.style.display = '';
                el.detailsToggleEl.innerText = '(x) hide details';
                HygeoLoadingSpinnerEl.INSTANCE.stop();
            })
        };
        const setCenterAndZoom = () => {
            let lastZoom;
            let lastZoomIn;
            let lastZoomOut;
            const adjustZoom = () => {
                const currentZoom = map.getZoom();

                const bboxInPixels = [...Object.values(map.project([bbox[0], bbox[1]])), ...Object.values(map.project([bbox[2], bbox[3]]))].map(n => Math.round(n * 10) / 10);
                const bboxHeight = Math.abs(bboxInPixels[0] - bboxInPixels[2]);
                const bboxWidth = Math.abs(bboxInPixels[1] - bboxInPixels[3]);
                const canvasHeight = parseInt(canvasStyle.height);
                const canvasWidth = parseInt(canvasStyle.width);
                log(`lastZoom: ${lastZoom}, lastZoomIn: ${lastZoomIn}, lastZoomOut: ${lastZoomOut}`)
                log(`move/zoom end, now adjusting zoom :: bboxInPixels: ${bboxInPixels}, bboxHeight: ${bboxHeight}, bboxWidth: ${bboxWidth}, canvasHeight: ${canvasHeight}, canvasWidth: ${canvasWidth},  currentZoom: ${currentZoom}, center: ${map.getCenter()}`);
                if (currentZoom === lastZoom || currentZoom > 16 || (lastZoomIn && lastZoomOut)) {
                    return; // sometimes the zoom might max out, then stop recursing
                }
                lastZoom = currentZoom;
                if (bboxInPixels[0] < 0 || bboxInPixels[0] > canvasWidth
                    || bboxInPixels[2] < 0 || bboxInPixels[2] > canvasWidth
                    || bboxInPixels[1] < 0 || bboxInPixels[1] > canvasHeight
                    || bboxInPixels[3] < 0 || bboxInPixels[3] > canvasHeight
                ) {
                    lastZoomOut = true;
                    map.once('moveend', adjustZoom)
                    map.setZoom(currentZoom * .98);
                } else if (bboxHeight < canvasHeight * .9 && bboxWidth < canvasWidth * .9) {
                    lastZoomIn = true;
                    map.once('moveend', adjustZoom)
                    map.setZoom(currentZoom * 1.05);
                }

            }

            map.flyTo({center: center.geometry.coordinates});
            map.once('moveend', adjustZoom);

        }

        const forEachSelectedProjectTile = callback => {
            Object.keys(intersectingProjects).filter(projectId => !!intersectingProjects[projectId].selected).forEach(projectId => {
                // if selected an array of 3 elements (on, off, mixed),
                if (Object.values(intersectingProjects[projectId].selected).filter(v => v).length >= 3) {
                    //  => no filter, all tiles
                    intersectingProjects[projectId].tiles.forEach(feature => callback(feature))
                } else if (intersectingProjects[projectId].selected instanceof Object) {
                    // Specific Leave state selected;  check if the feature leaves status is in selected hash
                    intersectingProjects[projectId].tiles
                        .filter(feature => intersectingProjects[projectId].selected[feature.properties.leaves])
                        .forEach(feature => callback(feature))
                }
            });
        }
        const hightlightIntersectionTiles = () => {
            let features = [];
            forEachSelectedProjectTile(feature => features.push(feature));
            mapSources.tiles.setData({type: 'FeatureCollection', features});
            mapSources.highlight.setData(aoiPolygonTurf);
        }
        const updateSelectedStats = () => {
            let selectedTileSize = 0;
            let selectedTileCount = 0;
            let selectedTileCountMissingLaz = 0;
            const addSelectedFeature = feature => {
                // Set the original totals of ALL project tiles
                selectedTileCount++;
                if (!feature.properties.laz_tile) {
                    selectedTileCountMissingLaz++;
                } else {
                    if (feature.properties.laz_size) {
                        selectedTileSize += feature.properties.laz_size_number;
                    }
                }
            };
            // Show selected/total stats: size, count and tile count missing LAZ data
            forEachSelectedProjectTile(addSelectedFeature);
            const missingTilesHtml = selectedTileCountMissingLaz ? `<span style="color: red">missing LAZ: ${selectedTileCountMissingLaz}/${intersectingProjectsTotals.tileCountMissingLaz}</span>` : ''
            selectedProjectsStatsEl.innerHTML = `
                ${selectedTileCount}/${intersectingProjectsTotals.tileCount} tiles 
                (${makeLazSizeReadable(selectedTileSize)}/${makeLazSizeReadable(intersectingProjectsTotals.tileSize)})
                ${missingTilesHtml}
            `;
        }
        const addAoiGeojsonControls = () => {
            const orignalPolygonInfoEl = el.querySelector('[data-aoi-polygon="info"]');
            const orignalPolygonBtnEl = el.querySelector('[data-aoi-polygon="geojson"]');
            const simplePolygonInfoEl = el.querySelector('[data-aoi-simple-polygon="info"]');
            const simplePolygonBtnEl = el.querySelector('[data-aoi-simple-polygon="geojson"]');
            const simplePolygonFileDownloadChk = el.querySelector('[data-aoi-simple-polygon="file-download"]');
            const simplifySimplePolygonBtnEl = el.querySelector('[data-aoi-simple-polygon="simplify"]');
            const revertSimplePolygonBtnEl = el.querySelector('[data-aoi-simple-polygon="revert"]');

            orignalPolygonInfoEl.innerHTML = orignalPolygonInfoEl.innerText
                .replace('{type}', aoiPolygonType)
                .replace('{polygonCount}', aoiPolygonType === 'multipolygon' ? data.coordinates.length: 1)
                .replace('{holeCount}', aoiPolygonType === 'multipolygon' ? data.coordinates.reduce((a, p) => a + p.length > 1 ? p.length - 1 : 0, 0) : (data.coordinates.length > 1 ? data.coordinates.length - 1 : 0))
                .replace('{vertexCount}', aoiPolygonType === 'multipolygon' ? data.coordinates.reduce((a, poly) => a+ poly.reduce((a,ring) => a + ring.length, 0), 0) : (data.coordinates.reduce((a, ring) => a + ring.length, 0)));

            const dataSimple = aoiPolygonSimpleTurf.geometry;
            simplePolygonInfoEl.originalInnerHTML = simplePolygonInfoEl.innerHTML
            simplePolygonInfoEl.innerHTML = simplePolygonInfoEl.originalInnerHTML
                .replace('{vertexCount}', dataSimple.coordinates[0].length);

            orignalPolygonBtnEl.addEventListener('click', e => {
                makeGlobalCopyPasteTextarea(JSON.stringify(data))
            })

            let simplifiedPolygonTurf = null;
            let simplifyLevel = 0.0001;
            simplePolygonBtnEl.addEventListener('click', e => {
                //  turfjs featureCollection needs to be given an *ARRAY* of features
                const simpleTurf = turf.featureCollection([simplifiedPolygonTurf || aoiPolygonSimpleTurf]);
                if (simplePolygonFileDownloadChk.checked) {
                    downloadJsonAsFile(simpleTurf, name.toLowerCase().replace(/\W/g, '-')+'.json');
                } else {
                    makeGlobalCopyPasteTextarea(JSON.stringify(simpleTurf));
                }
            })

            simplifySimplePolygonBtnEl.addEventListener('click', e => {
                simplifiedPolygonTurf = turf.simplify(aoiPolygonSimpleTurf, {tolerance: simplifyLevel, highQuality: false});
                simplifyLevel = simplifyLevel * 2;
                simplePolygonInfoEl.innerHTML = simplePolygonInfoEl.originalInnerHTML
                    .replace('{vertexCount}', simplifiedPolygonTurf.geometry.coordinates[0].length);
                mapSources.highlight.setData(simplifiedPolygonTurf);
            })
            revertSimplePolygonBtnEl.addEventListener('click', e => {
                simplifiedPolygonTurf = turf.polygon(dataSimple.coordinates);
                simplifyLevel = 0.0001;
                simplePolygonInfoEl.innerHTML = simplePolygonInfoEl.originalInnerHTML
                    .replace('{vertexCount}', simplifiedPolygonTurf.geometry.coordinates[0].length);
                mapSources.highlight.setData(simplifiedPolygonTurf);
            })

        };
        const addAoiProjectsControls = () => {
            const containerEl = el.querySelector('[data-intersecting-projects]');
            const templateEl = el.querySelector('[data-intersecting-project]');
            templateEl.parentElement.removeChild(templateEl);
            Object.keys(intersectingProjects).forEach(projectId => {
                const project = intersectingProjects[projectId].project;
                const projectEl = templateEl.cloneNode(true);
                const nameEl = projectEl.querySelector('[data-project-name]');
                const datesEl = projectEl.querySelector('[data-project-dates]');
                const sizeEl = projectEl.querySelector('[data-project-size]');
                const tileCountEl = projectEl.querySelector('[data-project-tile-count]');

                nameEl.innerText = projectId.replaceAll('_', ' ');
                datesEl.innerText = [project.date_start, project.date_end]
                    .map(d => d.replace(/(\d{4})(\d\d)(\d\d)/, '$1/$2/$3')).join(' - ');

                sizeEl.innerText = makeLazSizeReadable(intersectingProjects[projectId].tileSize);

                tileCountEl.innerText = intersectingProjects[projectId].tileCount;

                const missingTilesEl = projectEl.querySelector('[data-project-tile-count-missing-laz]');
                if (!intersectingProjects[projectId].tileCountMissingLaz) {
                    missingTilesEl.display = 'none';
                } else {
                    missingTilesEl.querySelector('span').innerText = intersectingProjects[projectId].tileCountMissingLaz;
                }
                
                const inputAll = projectEl.querySelector('input[data-all]');
                const inputLeavesOn = projectEl.querySelector('input[data-leaves-on]');
                const inputLeavesOff = projectEl.querySelector('input[data-leaves-off]');
                const inputLeavesMixed = projectEl.querySelector('input[data-leaves-mixed]');
                inputAll.checked = true;
                inputLeavesOn.checked = true;
                inputLeavesOff.checked = true;
                inputLeavesMixed.checked = true;

                const setProjectSelectedState = (type, state) => {
                    if (type === 'all') {
                        intersectingProjects[projectId].selected = state ? {on: true, off: true, mixed: true} : false;
                    } else {
                        if (!intersectingProjects[projectId].selected) {
                            intersectingProjects[projectId].selected = {};
                        }

                        intersectingProjects[projectId].selected[type] = state;

                        const selectedKeysLength = Object.values(intersectingProjects[projectId].selected).filter(v => v).length;
                        if (selectedKeysLength === 0) {
                            intersectingProjects[projectId].selected = false;
                        }
                    }

                    if (intersectingProjects[projectId].selected === false) {
                        inputAll.checked = false;
                        inputLeavesOn.checked = false;
                        inputLeavesOff.checked = false;
                        inputLeavesMixed.checked = false;
                    } else {
                        inputAll.checked = true;
                        inputLeavesOn.checked = intersectingProjects[projectId].selected['on'];
                        inputLeavesOff.checked = intersectingProjects[projectId].selected['off'];
                        inputLeavesMixed.checked = intersectingProjects[projectId].selected['mixed'];
                    }

                    hightlightIntersectionTiles();
                    updateSelectedStats();
                }
                inputAll.addEventListener('click', e => {
                    setProjectSelectedState('all', !!e.target.checked);
                });
                inputLeavesOn.addEventListener('click', e => {
                    setProjectSelectedState('on', !!e.target.checked);
                });
                inputLeavesOff.addEventListener('click', e => {
                    setProjectSelectedState('off', !!e.target.checked);
                });
                inputLeavesMixed.addEventListener('click', e => {
                    setProjectSelectedState('mixed', !!e.target.checked);
                });
                containerEl.appendChild(projectEl);
            })
        }
        const addAoiButtonHandlers = () => {
            el.querySelector('[data-tiles-geojson]').addEventListener('click', e => {
                const features = [];
                forEachSelectedProjectTile(feature => features.push(feature));
                makeGlobalCopyPasteTextarea(JSON.stringify({type: 'FeatureCollection', features}))
            })
            el.querySelector('[data-laz-list]').addEventListener('click', e => {
                const urls = [];
                forEachSelectedProjectTile(feature => urls.push(makeLazUrl(feature)));
                makeGlobalCopyPasteTextarea(urls.filter(url => !!url).join("\n"))
            })
        }
        intersectBtn.addEventListener('click', e => HygeoLoadingSpinnerEl.INSTANCE.start().then(findIntersection));
        el.detailsToggleEl.addEventListener('click', e => {
            el.isActive = !el.isActive;
            toggleDetailsEl(el.detailsEl, el.isActive)
            el.detailsToggleEl.innerText = el.isActive ? '(x) hide details' : '+ show details';

            if (el.isActive) {
                setCenterAndZoom();
                hightlightIntersectionTiles();
            }
            renderedElements.aois.forEach(el_ => {
                if (el === el_) {
                    return;
                }
                toggleDetailsEl(el_.detailsEl, false, 'withoutAnimation');
                el_.detailsToggleEl.innerText = '+ show details';
                el_.isActive = false;
            });
        });

        // init AOIs render element array
        if (!renderedElements.aois) {
            renderedElements.aois = [];
        }
        // hide other AOI details
        renderedElements.aois.forEach(el => {
            toggleDetailsEl(el.detailsEl, false);
            el.isActive = false;
        });
        // add current AOI to list
        renderedElements.aois.push(el);

        // finally, RENDER IT
        addControlEl(el, renderedElements.aoiContainer)


    }

    initNewAoiControl();
    initAoiContainerControl();
    const renderSavedAoiControls = () => {
        const savedAoiIds = localStorage.getItem('lidar-scraper:aoi-list');
        if (savedAoiIds) {
            savedAoiIds.split(';').forEach(id => {
                let aoi = localStorage.getItem(`lidar-scraper:aoi:${id}`);
                if (aoi) {
                    try {
                        aoi = JSON.parse(aoi);
                        initAoiControl(aoi.data, aoi.name, id)
                    } catch(e) {}
                }
            });
        }
    }
    HygeoLoadingSpinnerEl.INSTANCE.start();
    initMap()
    map.on('load', initData);

    const makeGlobalOverlay = text => {
        const containerEl = document.createElement('div');
        containerEl.classList.add('closeable-overlay');
        const closeEl = document.createElement('div');
        closeEl.dataset.el='close';
        closeEl.innerText = 'close (x)'
        const el = document.createElement('div');
        el.innerHTML = text;
        el.dataset.el = 'content';
        closeEl.addEventListener('click', e => containerEl.parentElement.removeChild(containerEl))
        containerEl.appendChild(el);
        containerEl.appendChild(closeEl);
        document.querySelector('body').appendChild(containerEl);
    }

    const downloadJsonAsFile = (json, fileName) => {
        let link = document.createElement("a");
        link.target = "_blank";
        link.download = fileName;
        link.href = window.URL.createObjectURL(new Blob([(json instanceof Object) ? JSON.stringify(json):json]), {type: "application/json"});
        link.click();
        window.URL.revokeObjectURL(link.href);
    }
    const makeGlobalCopyPasteTextarea = text => {
        const containerEl = document.createElement('div');
        containerEl.classList.add('closeable-overlay');
        const closeEl = document.createElement('div');
        closeEl.dataset.el='close';
        closeEl.innerText = 'close (x)'
        const el = document.createElement('textarea');
        el.dataset.el = 'content';
        el.readOnly = true;
        el.value = text;
        el.addEventListener('click', e => {
            el.focus();
            el.select();
        })
        closeEl.addEventListener('click', e => containerEl.parentElement.removeChild(containerEl))
        containerEl.appendChild(el);
        containerEl.appendChild(closeEl);
        document.querySelector('body').appendChild(containerEl);
    }

    const geoHelpers = {
        getPolygonFirstCoordinate: featureOrCoordinates => {
            const coordinates = featureOrCoordinates.geometry ? featureOrCoordinates.geometry.coordinates : featureOrCoordinates;
            const isMulti = typeof (coordinates[0][0][0]) === 'object';
            return isMulti ? coordinates[0][0][0] : coordinates[0][0];
        }
    }
    const makeLazUrl = (tileFeature) => {
        if (!tileFeature.properties.laz_tile) {
            return '';
        }
        const props = tileFeature.properties;
        const [project, subproject] = props.project.split('/');
        const tileName = props.laz_tile.replace('{u}', 'USGS_LPC_').replace('{prj}', project).replace('{sprj}', subproject);
        return `${USGS_URL_BASE}/${props.project}/${props.laz_url_dir}/${tileName}.laz`
    }
    const getLazTileId = (tileFeature) => {
        if (!tileFeature.properties.laz_tile) {
            return null;
        }
        return tileFeature.properties.laz_tile.replace(/\{(u|s?prj)\}_*/g, '');
    }

    const makeLazSizeReadable = (size) => {
        let factor = 30;
        let suffix = 'GB';
        if (size < Math.pow(2, 20)) {
            factor = 10;
            suffix = 'KB';
        } else if (size < Math.pow(2, 30)) {
            factor = 20;
            suffix = 'MB';
        }
        return String(Math.round(10 * size / Math.pow(2, factor))/10).replace(/(\.\d).+$/, '$1') + suffix;
    }
    const parseLazSize = (sizeString) => {
        const sizeNumber = parseFloat(sizeString);
        const sizeFactor = sizeString.toUpperCase().replace(/[0-9\.]/g, '')
        const sizeFactorNumber = Math.pow(2, ({
            K: 10,
            M: 20,
            G: 30
        })[sizeFactor]); // KiloByte = 2 ^ 10, MB = 2 ^ 20, GB = 2 ^ 30
        return sizeNumber * sizeFactorNumber;
    }
}
