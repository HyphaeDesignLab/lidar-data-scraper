function LidarScraperMap() {
    const USGS_URL_BASE = 'https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects'
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
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/hyphae-lab/clb2h2e48000015o4w0b0tyig',
            center: customCenter ?? [-121.87209750161911, 41.648412869824384],
            zoom: customZoom ?? 6.5
        });
    }


    let layersToQuery = ['all'];
    const mapSources = {'highlight': null, 'all': null, 'project': null}
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

        map.addSource('project', {
            type: 'geojson',
            data: {type: 'FeatureCollection', features: []}
        });
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

    function loadProjectData(projectFeature, immediatelyDisplayLoadedData = true) {
        const project = projectFeature.properties.project;
        const parentFeatureId = parseInt(projectFeature.id);
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
                        feature.properties.type = 'project'
                        feature.properties.project = project
                        feature.properties.laz_url_dir = projectFeature.properties.laz_url_dir;
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
        switch (mode) {
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
        mapSources.highlight.setData({type: 'FeatureCollection', features: [feature]});
        renderPopup(feature, mapClickEventLngLat)
    }

    function renderPopup(feature, mapClickLngLat) {
        const dateStart = feature.properties.date_start.replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')
        const dateEnd = feature.properties.date_end.replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')
        const leavesStatus = feature.properties.leaves.toUpperCase();
        const projectName = feature.properties.project.replace('/', ': ').replaceAll('_', ' ');
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
    <a href="#" data-load-more-tiles="start">see tiles</a>
    </div>
</div>
`;
            clickHandlers = () => {
                addProjectPopupClickHandlers(feature)
            };
        } else {
            const lazUrl = makeLazUrl(feature);
            const lazSize = feature.properties.laz_size;
            html = `
<div><strong>Project TILE ${feature.id}: <br/></strong> (${projectName})</div>
<div>
    leaves are ${leavesStatus}<br/>
    from ${dateStart} to ${dateEnd}<br/>
    <br/>
    <div>
    <div data-load-more-tiles="error" style="color: red; display: none"></div>
    <span data-load-more-tiles="loading" style="display: none">downloading tiles...</span>
    <a href="${lazUrl}" target="_blank">download LAZ tile (${lazSize})</a>
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
            e.preventDefault();
            e.stopPropagation();
            loadingTilesEl.style.display = '';
            loadTilesEl.style.display = 'none';
            loadTilesErrorEl.innerText = '';
            loadTilesErrorEl.style.display = 'none';
            setTimeout(() => {
                loadProjectData(projectFeature)
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
    const initAoiControl = (data) => {
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
        let aoiDataTurf;
        switch (data.type) {
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
        const nameEditEl = el.querySelector('[data-name-edit]')
        nameEl.innerText = `New area of interest ${String(new Date()).substring(0, 21)}`
        nameEditEl.addEventListener('click', e => {
            nameEl._isContentEditable = !nameEl._isContentEditable; // custom property boolean
            nameEl.contentEditable = nameEl._isContentEditable; // string proper DOM property; assignment will cast boolean to string
            nameEditEl.innerText = nameEl._isContentEditable ? 'save' : 'edit name';
            if (nameEl._isContentEditable) {
                nameEl.focus();
            } else {
                nameEditEl.focus();
            }
        });

        el.detailsEl = el.querySelector('[data-details]')
        const detailsToggleEl = el.querySelector('[data-details-toggle]')
        const intersectBtn = el.querySelector('button[data-button="intersect"]')
        const missingLazTilesEl = el.querySelector('[data-missing-tiles]')
        const selectedProjectsLazSizeEl = el.querySelector('[data-selected-laz-size]')
        const bbox = turf.bbox(aoiDataTurf);
        const center = turf.center(aoiDataTurf);
        const canvasStyle = getComputedStyle(map.getCanvas());

        const intersectingTiles = {};
        const intersectingTilesLazUrls = {};
        const intersectingTilesLazSizes = {};
        const intersectingProjects = {};
        const intersectingProjectsSelected = {};
        const findIntersection = () => {
            setCenterAndZoom();

            intersectBtn.disabled = true;


            const loadDataPromises = [];
            mapData.all.features.forEach(feature => {
                const turfProjectPoly = turf[typeof (feature.geometry.coordinates[0][0][0]) === 'number' ? 'polygon' : 'multiPolygon'](feature.geometry.coordinates, feature.properties)
                if (turf.booleanIntersects(aoiDataTurf, turfProjectPoly)) {
                    intersectingProjects[feature.properties.project] = feature.properties;
                    const loadPromise = loadProjectData(feature, false);
                    loadDataPromises.push(loadPromise);
                }
            })
            Promise.all(loadDataPromises).then(() => {

                let missingLazTilesCount = 0;
                Object.keys(intersectingProjects).forEach(project => {
                    mapData[project].features.forEach(feature => {
                        const turfProjectTilePoly = turf.polygon(feature.geometry.coordinates, feature.properties)
                        if (turf.booleanIntersects(aoiDataTurf, turfProjectTilePoly)) {
                            if (!intersectingTiles[project]) {
                                intersectingTiles[project] = [];
                                intersectingTilesLazUrls[project] = [];
                                intersectingTilesLazSizes[project] = 0;
                            }
                            intersectingProjectsSelected[project] = true;
                            intersectingTiles[project].push(feature);
                            if (feature.properties.laz_tile) {
                                intersectingTilesLazUrls[project].push(makeLazUrl(feature))
                                if (feature.properties.laz_size) {
                                    intersectingTilesLazSizes[project] += parseLazSize(feature.properties.laz_size)
                                }
                            } else {
                                missingLazTilesCount++;
                            }
                        }
                    });
                });

                addProjectSelector();
                addTextboxes();
                hightlightIntersectionTiles();
                updateSelectedSize();

                intersectBtn.style.display = 'none';
                el.isActive = true;
                el.detailsEl.style.display = '';
                if (missingLazTilesCount > 0) {
                    missingLazTilesEl.style.display = '';
                    missingLazTilesEl.children[0].innerText = missingLazTilesCount;
                }
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
        const hightlightIntersectionTiles = () => {
            const features = [];
            Object.keys(intersectingProjectsSelected).forEach(project => {
                if (intersectingProjectsSelected[project]) {
                    features.push(...intersectingTiles[project]);
                }
            })
            mapSources.project.setData({type: 'FeatureCollection', features});
            mapSources.highlight.setData(aoiDataTurf);
        }
        const updateSelectedSize = () => {
            let size = 0;
            Object.keys(intersectingProjectsSelected).forEach(project => {
                if (intersectingProjectsSelected[project]) {
                    size += intersectingTilesLazSizes[project];
                }
            });
            selectedProjectsLazSizeEl.innerText = makeLazSizeReadable(size);
        }
        const addProjectSelector = () => {
            const containerEl = el.querySelector('[data-intersecting-projects]');
            const templateEl = el.querySelector('[data-intersecting-project]');
            templateEl.parentElement.removeChild(templateEl);
            Object.keys(intersectingProjects).forEach(projectName => {
                const project = intersectingProjects[projectName];
                const projectEl = templateEl.cloneNode(true);
                projectEl.querySelector('span').innerText = `${project.date_start.replace(/(\d{4})(\d\d)(\d\d)/, '$1/$2/$3')} - ${project.date_end.replace(/(\d{4})(\d\d)(\d\d)/, '$1/$2/$3')}, ${makeLazSizeReadable(intersectingTilesLazSizes[projectName])} (${projectName.replaceAll('_', ' ')})`
                const input = projectEl.querySelector('input');
                input.checked = true;
                input.addEventListener('click', e => {
                    log(e.target.checked);
                    intersectingProjectsSelected[projectName] = e.target.checked;
                    hightlightIntersectionTiles();
                    updateSelectedSize();
                });
                containerEl.appendChild(projectEl);
            })
        }
        const addTextboxes = () => {
            el.querySelector('[data-tiles-geojson]').addEventListener('click', e => {
                const features = [];
                Object.keys(intersectingProjectsSelected).forEach(project => {
                    if (intersectingProjectsSelected[project]) {
                        features.push(...intersectingTiles[project]);
                    }
                })
                makeGlobalCopyPasteTextarea(JSON.stringify({type: 'FeatureCollection', features}))
            })
            el.querySelector('[data-laz-list]').addEventListener('click', e => {
                const urls = [];
                Object.keys(intersectingProjectsSelected).forEach(project => {
                    if (intersectingProjectsSelected[project]) {
                        urls.push(...intersectingTilesLazUrls[project]);
                    }
                });
                makeGlobalCopyPasteTextarea(urls.join("\n"))
            })
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


    const makeGlobalCopyPasteTextarea = text => {
        const containerEl = document.createElement('div');
        containerEl.classList.add('copy-paste-global-popup');
        const closeEl = document.createElement('div');
        closeEl.innerText = 'close (x)'
        const el = document.createElement('textarea');
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
        const props = tileFeature.properties;
        const [project, subproject] = props.project.split('/');
        const tileName = props.laz_tile.replace('{u}', 'USGS_LPC_').replace('{prj}', project).replace('{sprj}', subproject);
        return `${USGS_URL_BASE}/${props.project}/${props.laz_url_dir}/${tileName}.laz`
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
