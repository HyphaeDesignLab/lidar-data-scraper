function LidarScraperMap() {
    if (LidarScraperMap.__IS_INIT) {
        return;
    }
    LidarScraperMap.__IS_INIT = true

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



    let layersToQuery = [];
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
            if (!data.features[0].id) {
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

        map.on('click', onMapClick);
    }

    function loadProjectData(project, parentFeatureId) {
        const loadData = () => {
            mapData.project = mapData[project];
            mapSources.project.setData(mapData.project); // update
            setClickMode('project')
        }
        if (mapData[project]) {
            loadData()
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
                    loadData()
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
            // weird behavior of mapbox selecting partial complex polygon returned by queryRenderedFeatures() at various zoom levels
            const featureToHighlight = features[0].properties.type === 'all' ? mapData.all.features.find(f => f.id === features[0].id) : features[0];
            mapSources.highlight.setData({type: 'FeatureCollection', features: [featureToHighlight]});
            renderPopover(features[0], clickEvent.lngLat)
        }
    }
    function renderMultiLayerChooser(features, mapClickEventLngLat) {
        const listEl = document.createElement('ul');
        listEl.style.padding = '0';
        const headingEl = document.createElement('div');
        headingEl.innerText = 'choose a layer to view details:'
        listEl.appendChild(headingEl)
        let popover = null
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
                popover.remove();
                onMultiLayerChooserClick(feature, mapClickEventLngLat)
            })
            listEl.appendChild(el);
        })
        popover = initPopoverObject(listEl, mapClickEventLngLat);
    }
    function onMultiLayerChooserClick(feature, mapClickEventLngLat) {
        mapSources.highlight.setData({type: 'FeatureCollection', features: [feature]});
        renderPopover(feature, mapClickEventLngLat)
    }

    function renderPopover(feature, mapClickLngLat) {
        const dateStart = feature.properties.date_start.replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')
        const dateEnd = feature.properties.date_end.replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')
        const leavesStatus = feature.properties.leaves.toUpperCase();
        const projectName = feature.properties.project.replace('/', ': ').replaceAll('_', ' ');
        const projectId = feature.properties.project;
        const tileCount = feature.properties.tile_count;

        // if the feature clicked on to show popover for is the "bounding box" tile of a project (not the individual tile within a project)
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
            clickHandlers = addProjectPopoverClickHandlers;
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
        initPopoverObject(html, mapClickLngLat, clickHandlers);
    }

    function addProjectPopoverClickHandlers() {
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

    function initPopoverObject(htmlOrEl, popoverLngLat, onOpenCallback) {
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
        const popup = new mapboxgl.Popup({
            offset: popupOffsets,
            className: 'my-class',
            closeOnClick: true,
            closeOnMove: true
        })
            .setLngLat(popoverLngLat)
            .setMaxWidth("300px");
        if (htmlOrEl instanceof Object) {
            popup.setDOMContent(htmlOrEl)
        } else {
            popup.setHTML(htmlOrEl)
        }
        if (onOpenCallback) {
            popup.on('open', onOpenCallback);
        }
        popup.addTo(map)
        return popup
    }



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
        renderProjectControlEl(project)
    }
    function renderProjectControlEl(project) {
        const el = document.createElement('div')
        el.innerHTML = `<div>${project}</div>`
        controlsEl.contentEl.appendChild(el);
    }
    function addControlEl(el) {
        controlsEl.contentEl.appendChild(el);
    }


    // ------------------- Polygon Intersection -------------------
    function initPolygonIntersectionControl() {
        const polygonIntersectControlTemplateEl = document.querySelector('[data-controls=polygon-intersect]');
        const polygonIntersectControlEl = polygonIntersectControlTemplateEl.cloneNode(true)
        polygonIntersectControlEl.querySelector('input[type=button]').addEventListener('click', e => {
            const json = JSON.parse(polygonIntersectControlEl.querySelector('textarea').value);
            const turfPolygon = turf.polygon(json.type ? json.coordinates : [json]);
            const intersections = []
            turfData.all.features.forEach(f => {
                const turfFeatureGeometry = turf[ typeof(f.geometry.coordinates[0][0][0]) === 'number' ? 'polygon':'multiPolygon'](f.geometry.coordinates, f.properties)
                if (turf.intersect(turfPolygon, turfFeatureGeometry)) {
                    intersections.push(f);
                }
            })
            log(intersections)
            mapSources.highlight.setData({type: 'FeatureCollection', features: [intersections[0]]});
            map.flyTo({center: geoHelpers.getPolygonFirstCoordinate(intersections[0])})
        })
        addControlEl(polygonIntersectControlEl)

    }
    initPolygonIntersectionControl()



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
