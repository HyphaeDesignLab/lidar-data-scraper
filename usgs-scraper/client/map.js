function LidarScraperMap() {
    const USGS_URL_BASE = 'https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/'
    if (LidarScraperMap.__IS_INIT) {
        return;
    }
    LidarScraperMap.__IS_INIT = true

    if (window.location.search.indexOf('map=fake') > 0) {
        window.mapboxgl = FakeMapboxglMap;
        window.MapboxDraw = FakeMapboxDraw;
    }
    const log = window.location.search.indexOf('debug=') < 0 ? () => {} : (...things) => {
        things.forEach(thing => {
            console.log(thing)
        });
    };

    window.map=null
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
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/hyphae-lab/clb2h2e48000015o4w0b0tyig',
            center: customCenter ?? [-121.87209750161911, 41.648412869824384],
            zoom: customZoom ?? 6.5
        });
    }



    let layersToQuery = ['all'];
    const mapSources = {'highlight': null, 'all':null, 'project': null}
    window.mapData = {};
    window.turfData = {};

    function initData() {
        let customDataFile = null;
        if (window.location.search) {
            const customDataFileMatch = window.location.search.match(/data=([^&]+)/)
            if (customDataFileMatch) {
                customDataFile = customDataFileMatch[1]
            }
        }
        const dataFile = customDataFile ? customDataFile : 'projects/leaves-status.json'
        fetch(dataFile)
            .then(response => response.json())
            .then(data => loadAllProjectsData(data));
    }

    const allProjectsFillColorForMode = {
        'all': ["case",
            ['==', ['get', 'leaves'], 'on'], ["rgba", 90, 255, 112, .5], // "#5aff70",
            ['==', ['get', 'leaves'], 'off'], ["rgba", 252, 174, 81, .5], // "#fcae51"
            ["rgba", 252, 81, 121, .5] // "#fc5179"
        ],
        'project': ["case",
            ['==', ['get', 'leaves'], 'on'], ["rgba", 90, 255, 112, .2], // "#5aff70",
            ['==', ['get', 'leaves'], 'off'], ["rgba", 252, 174, 81, .2], // "#fcae51"
            ["rgba", 252, 81, 121, .2] // "#fc5179"
        ]
    }
    function loadAllProjectsData(data) {
        mapData.all = data;
        log(data)
        turfData.all = turf.featureCollection(data.features)

        data.features.forEach((feature, i) => {
            feature.properties.type = 'all'
            addProjectControlEl(feature.properties.project)
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

        map.addSource('all', {type: 'geojson', data});
        mapSources.all = map.getSource('all')
        map.addLayer({
            'id': 'all',
            'type': 'fill',
            'source': 'all',
            "paint": {
                "fill-color": allProjectsFillColorForMode.all,
                "fill-opacity": .8, // default
                "fill-outline-color": ['case',
                    ['==', ['feature-state', 'focused'], true], "#222222",
                    ['==', ['get', 'leaves'], 'on'], "#047e16",
                    "#a94202"
                ]
            }
        });

        map.addSource('project', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
        mapSources.project = map.getSource('project')
        map.addLayer({
            'id': 'project',
            'type': 'fill',
            'source': 'project',
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
        //     'id': 'project',
        //     'type': 'fill',
        //     'source': 'project',
        //     "paint": {
        //         "fill-color": "#aaaaff",
        //         "fill-opacity": .9,
        //         "fill-outline-color": "#0000aa"
        //     }
        // });

        toggleMapClick(true);
    }

    function loadProjectData(project, parentFeatureId, immediatelyDisplayLoadedData=true) {
        const loadData_ = () => {
            if (immediatelyDisplayLoadedData) {
                mapSources.project.setData(mapData[project]); // update
            }
            setClickMode('project')
        }
        if (mapData[project]) {
            loadData_()
            return Promise.resolve();
        } else {
            parentFeatureId = parseInt(parentFeatureId)
            return fetch(`projects/${project}/xml_tiles.json`)
                .then(response => response.json())
                .then(data => {
                    if (!data.features[0].id) {
                        const baseNumber = parentFeatureId * Math.pow(10, String(data.features.length).length)
                        data.features.forEach((feature, i) => {
                            feature.id = baseNumber + (i + 1);
                        })
                    }
                    data.features.forEach(feature => {
                        feature.properties.type = 'project'
                    })

                    // update source
                    mapData[project] = data;
                    loadData_()
                })
        }

    }

    let clickMode = 'all'
    function setClickMode(mode) {
        clickMode = mode;
        switch(mode) {
            case 'all':
                layersToQuery = ['all'];
                map.setPaintProperty('all', 'fill-color', allProjectsFillColorForMode.all);
                break;
            case 'project':
                map.setPaintProperty('all', 'fill-color', allProjectsFillColorForMode.project);
                layersToQuery = ['project'];
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
        var features = map.queryRenderedFeatures(clickEvent.point, {layers: layersToQuery});
        log(features);

        if (!features.length) {
            setClickMode('all')
            mapSources.highlight.setData({type: 'FeatureCollection', features: []});
            return;
        }
        if (features.length > 1) {
            renderMultiLayerChooser(features, clickEvent.lngLat)
        } else {
            const feature = features[0];
            // weird behavior of mapbox selecting partial complex polygon returned by queryRenderedFeatures() at various zoom levels
            // const feature = features[0].properties.type === 'all' ? mapData.all.features.find(f => f.id === features[0].id) : features[0];
            mapSources.highlight.setData({type: 'FeatureCollection', features: [feature]});
            log(feature)
            renderPopup(feature, clickEvent.lngLat)
        }
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
            const name = !feature.properties.is_bbox ?
                `tile ${feature.id} (${projectName})`
                :`project ${projectName} with ${feature.properties.tile_count} tiles`;
            const el = document.createElement('li');
            el.style.cursor='pointer'
            el.style.textDecoration='underline'
            el.style.margin='0'
            el.style.marginLeft='10px'
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
        mapSources.highlight.setData({type: 'FeatureCollection', features: [feature]});
        renderPopup(feature, mapClickEventLngLat)
    }

    function renderPopup(feature, mapClickLngLat) {
        const dateStart = feature.properties.date_start.replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')
        const dateEnd = feature.properties.date_end.replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')
        const leavesStatus = feature.properties.leaves.toUpperCase();
        const projectName = feature.properties.project.replace('/', ': ').replaceAll('_', ' ');
        const projectId = feature.properties.project;
        const tileCount = feature.properties.tile_count;

        // if the feature clicked on to show popup for is the "bounding box" tile of a project (not the individual tile within a project)
        const isBbox = feature.properties.is_bbox;

        let clickHandlers = null;
        let html = '';
        if (isBbox) {
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
    <a href="#"
        data-load-more-tiles="start"
        data-project="${projectId}"
        data-feature-id="${feature.id}">
        see tiles</a>
    </div>
</div>
`;
            clickHandlers = addProjectPopupClickHandlers;
        } else {
            html = `
<div><strong>Project TILE ${feature.id}: <br/></strong> (${projectName})</div>
<div>
    leaves are ${leavesStatus}<br/>
    from ${dateStart} to ${dateEnd}<br/>
    <br/>
    <div>
    <div data-load-more-tiles="error" style="color: red; display: none"></div>
    <span data-load-more-tiles="loading" style="display: none">downloading tiles...</span>
    <a href="#"
        data-load-more-tiles="start"
        data-project="${projectId}"
        data-feature-id="${feature.id}">
        download tile</a>
    </div>
</div>
`;
        }
        initPopupObject(html, mapClickLngLat, clickHandlers);
    }

    function addProjectPopupClickHandlers() {
        const loadTilesEl = document.querySelector('[data-load-more-tiles=start]');
        const loadTilesErrorEl = document.querySelector('[data-load-more-tiles=error]');
        const loadingTilesEl = document.querySelector('[data-load-more-tiles=loading]');
        loadTilesEl.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            loadingTilesEl.style.display = '';
            loadTilesEl.style.display = 'none';
            loadTilesErrorEl.innerText = '';
            loadTilesErrorEl.style.display = 'none';
            setTimeout(() => {
                loadProjectData(e.target.dataset.project, e.target.dataset.featureId)
                    .then(() => {
                        loadTilesEl.style.display = 'none';
                        loadingTilesEl.style.display = 'none'
                        loadTilesErrorEl.style.display = 'none'
                    })
                    .catch(e => {
                        loadTilesErrorEl.style.display = ''
                        loadTilesErrorEl.innerText = e.message
                        loadingTilesEl.style.display = 'none'
                        loadTilesEl.style.display = ''
                    });
            }, 2000)
        })
    }

    let lastPopup;
    function initPopupObject(htmlOrEl, popupLngLat, onOpenCallback) {
        var markerHeight = 50, markerRadius = 10, linearOffset = 25;
        var popupOffsets = {
            'top': [0, 0],
            'top-left': [0, 0],
            'top-right': [0, 0],
            'bottom': [0, -markerHeight],
            'bottom-left': [linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
            'bottom-right': [-linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
            'left': [markerRadius, (markerHeight - markerRadius) * -1],
            'right': [-markerRadius, (markerHeight - markerRadius) * -1]
        };
        if (lastPopup) {
            lastPopup.setHTML(''); // reset
        }
        lastPopup = new mapboxgl.Popup({
            offset: popupOffsets,
            className: 'my-class',
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
    function addControlEl(el, parentEl=null) {
        (parentEl ? parentEl : controlsEl.contentEl).appendChild(el);
    }


    // ------------------- Area of Interest Intersection Tools -------------------
    const newAoiControlTemplateEl = document.querySelector('[data-controls=add-area-of-interest]');
    newAoiControlTemplateEl.parentElement.removeChild(newAoiControlTemplateEl);
    const initNewAoiControl = () => {
        const setAoiData = featureCollection => {
            //mapSources.highlight.setData(featureCollection);
            initAoiControl(featureCollection)
        }

        const el = newAoiControlTemplateEl.cloneNode(true);

        const methodLinks = el.querySelectorAll('[data-aoi-method-link]');
        const methodContainers = el.querySelectorAll('[data-aoi-method]');
        methodContainers.forEach(el => el.style.display='none');
        methodLinks.forEach(el => {
            el.addEventListener('click', e => {
                methodLinks.forEach(el_ => el_.style.background = el === el_ ?'lightgrey':'unset');
                methodContainers.forEach(containerEl => {
                    containerEl.style.display = el.dataset.aoiMethodLink === containerEl.dataset.aoiMethod ? '':'none';
                });

                e.preventDefault();
                return false;
            })
        })

        const drawStartBtn = el.querySelector('[data-aoi-method="draw"] [data-aoi-draw=start]');
        const drawStopBtn = el.querySelector('[data-aoi-method="draw"] [data-aoi-draw=stop]');
        const drawCancelBtn = el.querySelector('[data-aoi-method="draw"] [data-aoi-draw=cancel]');

        drawStopBtn.style.display='none';
        drawCancelBtn.style.display='none';

        let drawState = false;
        let mapboxDrawObj = false;
        drawStartBtn.addEventListener('click', e => {
            if (drawState) {
                return;
            }
            drawState = true;
            toggleMapClick(!drawState); // invert-set map click when in "draw on map" mode

            drawStartBtn.style.display='none';
            drawStopBtn.style.display='';
            drawCancelBtn.style.display='';

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
        });
        drawStopBtn.addEventListener('click', e => {
            if (!drawState) {
                return;
            }
            drawState = false;
            toggleMapClick(!drawState); // invert-set map click when in "draw on map" mode

            drawStartBtn.style.display='';
            drawStopBtn.style.display='none';
            drawCancelBtn.style.display='none';

            const featureCollection = mapboxDrawObj.getAll();
            mapboxDrawObj.changeMode('simple_select')
            mapboxDrawObj.deleteAll();
            setAoiData(featureCollection);
        });
        drawCancelBtn.addEventListener('click', e => {
            if (!drawState) {
                return;
            }
            drawState = false;
            toggleMapClick(!drawState); // invert-set map click when in "draw on map" mode

            drawStartBtn.style.display='';
            drawStopBtn.style.display='none';
            drawCancelBtn.style.display='none';

            mapboxDrawObj.changeMode('simple_select')
            mapboxDrawObj.deleteAll();
            setAoiData(null);
        });

        const fileEl = el.querySelector('[data-aoi-method="file"] input');
        const fileAddEl = el.querySelector('[data-aoi-method="file"] button');
        fileAddEl.addEventListener('click', e => {
            var reader = new FileReader();
            reader.readAsText(fileEl.files[0], 'UTF-8');
            reader.onload = function(e) {
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
    const initAoiControl = (data) => {
        switch(data.type) {
            case 'FeatureCollection':
                data = data.features[0].geometry
                break;
            case 'Feature':
                data = data.geometry
                break;
        }
        let aoiDataTurf;
        switch(data.type) {
            case 'Polygon':
                aoiDataTurf = turf.polygon(data.coordinates);
                break;
            case 'MultiPolygon':
                aoiDataTurf = turf.multiPolygon(data.coordinates);
                break;
            default:
                // assume outer polygon ring coordinates [ [x,y], [x2,y2], ... ]
                aoiDataTurf = turf.polygon([data]);
        }

        const el = aoiControlTemplateEl.cloneNode(true);
        const nameEl = el.querySelector('[data-name]')
        nameEl.innerText = `New area of interest ${String(new Date()).substring(0,21)}`
        el.detailsEl = el.querySelector('[data-details]')
        const detailsToggleEl = el.querySelector('[data-details-toggle]')
        const intersectBtn = el.querySelector('button[data-button="intersect"]')
        const lazUrlsEl = el.querySelector('[data-laz-list]');
        const tilesGeoJsonEl = el.querySelector('[data-tiles-geojson]')
        const missingLazTilesEl = el.querySelector('[data-missing-tiles]')
        const bbox = turf.bbox(aoiDataTurf);
        const center = turf.center(aoiDataTurf);
        const canvasStyle = getComputedStyle(map.getCanvas());

        let intersectionTiles;
        const findIntersection = () => {
            setCenterAndZoom();

            intersectBtn.disabled = true;

            const intersectingProjects = [];
            const loadDataPromises = [];
            turfData.all.features.forEach(feature => {
                const turfProjectPoly = turf[ typeof(feature.geometry.coordinates[0][0][0]) === 'number' ? 'polygon':'multiPolygon'](feature.geometry.coordinates, feature.properties)
                if (turf.booleanIntersects(aoiDataTurf, turfProjectPoly)) {
                    intersectingProjects.push(feature.properties.project);
                    const loadPromise = loadProjectData(feature.properties.project, feature.id, false);
                    loadDataPromises.push(loadPromise);
                }
            })
            Promise.all(loadDataPromises).then(() => {
                const combinedFeatures = [];
                const lazUrls = [];
                missingLazTilesCount = 0;
                intersectingProjects.forEach(project => {
                    mapData[project].features.forEach(feature => {
                        const turfProjectTilePoly = turf.polygon(feature.geometry.coordinates, feature.properties)
                        if (turf.booleanIntersects(aoiDataTurf, turfProjectTilePoly)) {
                            combinedFeatures.push(feature);
                            if (!feature.properties.lazTilePath || feature.properties.lazTilePath !== 'missing') {
                                lazUrls.push(`${USGS_URL_BASE}/${feature.properties.project}/${feature.properties.lazTilePath}`)
                            } else {
                                missingLazTilesCount++;
                            }
                        }
                    });
                });

                intersectionTiles = {type: 'FeatureCollection', features: combinedFeatures};
                hightlightIntersectionTiles();

                intersectBtn.style.display = 'none';
                el.isActive = true;

                el.detailsEl.style.display = '';
                lazUrlsEl.children[0].value = lazUrls.join('\n');
                tilesGeoJsonEl.children[0].value = JSON.stringify(intersectionTiles)
                if (missingLazTilesCount > 0) {
                    missingLazTilesEl.style.display='';
                    missingLazTilesEl.children[0].innerText = missingLazTilesCount;
                }
            })
        };
        const setCenterAndZoom = () => {
            let lastZoom;
            const adjustZoom = () => {
                const currentZoom = map.getZoom();
                if (currentZoom === lastZoom || currentZoom > 16) {
                    return; // sometimes the zoom might max out, then stop recursing
                }
                const bboxInPixels = [ ...Object.values(map.project([bbox[0], bbox[1]])), ...Object.values(map.project([bbox[2], bbox[3]])) ]
                const bboxHeight = Math.abs(bboxInPixels[0] - bboxInPixels[2]);
                const bboxWidth = Math.abs(bboxInPixels[1] - bboxInPixels[3]);
                const canvasHeight = parseInt(canvasStyle.height);
                const canvasWidth = parseInt(canvasStyle.width);
                log(`move/zoom end, now adjusting zoom :: bboxInPixels: ${bboxInPixels}, bboxHeight: ${bboxHeight}, bboxWidth: ${bboxWidth}, canvasHeight: ${canvasHeight}, canvasWidth: ${canvasWidth},  currentZoom: ${currentZoom}, center: ${map.getCenter()}`);
                if (bboxInPixels[0] < 0 || bboxInPixels[0] > canvasWidth
                    || bboxInPixels[2] < 0 || bboxInPixels[2] > canvasWidth
                    || bboxInPixels[1] < 0 || bboxInPixels[1] > canvasHeight
                    || bboxInPixels[3] < 0 || bboxInPixels[3] > canvasHeight
                ) {
                    map.once('moveend', adjustZoom)
                    map.setZoom(currentZoom * .9);
                } else if (bboxHeight < canvasHeight * .9 && bboxWidth < canvasWidth * .9) {
                    map.once('moveend', adjustZoom)
                    map.setZoom(currentZoom * 1.02);
                }
                lastZoom = currentZoom;
            }

            map.flyTo({center: center.geometry.coordinates});
            map.once('moveend', adjustZoom);

        }
        const hightlightIntersectionTiles = ()  => {
            mapSources.project.setData(intersectionTiles);
            mapSources.highlight.setData(aoiDataTurf);
        }
        intersectBtn.addEventListener('click', findIntersection);
        detailsToggleEl.addEventListener('click', e => {
            el.isActive = !el.isActive;
            el.detailsEl.style.display = el.isActive ? '' : 'none';
            if (el.isActive) {
                setCenterAndZoom();
                hightlightIntersectionTiles();
            }
            renderedElements.aois.forEach(el_ => {
                if (el === el_) {
                    return;
                }
                el_.detailsEl.style.display = 'none';
                el_.isActive = false;
            });
        });

        // init AOIs render element array
        if (!renderedElements.aois) {
            renderedElements.aois = [];
        }
        // hide other AOI details
        renderedElements.aois.forEach(el => {
            el.detailsEl.style.display = 'none';
            el.isActive = false;
        });
        // add current AOI to list
        renderedElements.aois.push(el);

        // finally, RENDER IT
        addControlEl(el, renderedElements.aoiContainer)


    }

    initNewAoiControl();
    initAoiContainerControl();



    initMap()
    map.on('load', initData);
}

const geoHelpers = {
    getPolygonFirstCoordinate: featureOrCoordinates => {
        const coordinates = featureOrCoordinates.geometry ? featureOrCoordinates.geometry.coordinates : featureOrCoordinates;
        const isMulti = typeof(coordinates[0][0][0]) === 'object';
        return isMulti ? coordinates[0][0][0] : coordinates[0][0];
    }
}
