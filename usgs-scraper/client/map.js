
function LidarScraperMap() {
    if (LidarScraperMap.__IS_INIT) {
        return;
    }
    LidarScraperMap.__IS_INIT = true

    const logEl = document.querySelector('#log');
    const log = (...things) => {
        things.forEach(thing => {
            logEl.innerHTML += thing + " \n";
        });
    };
    mapboxgl.accessToken = 'pk.eyJ1IjoiaHlwaGFlLWxhYiIsImEiOiJjazN4czF2M2swZmhkM25vMnd2MXZrYm11In0.LS_KIw8THi2qIethuAf2mw';

    let customCenter = null;
    let customDataFile = null;
    let customZoom = null;
    if (window.location.search) {
        const customCenterMatch = window.location.search.match(/center=([^&]+)/);
        const customZoomMatch = window.location.search.match(/zoom=([^&]+)/)
        const customDataFileMatch = window.location.search.match(/data=([^&]+)/)
        if (customCenterMatch) {
            customCenter = customCenterMatch[1].split(',').map(i => parseFloat(i));
        }
        if (customZoomMatch) {
            customZoom = parseInt(customZoomMatch[1])
        }
        if (customDataFileMatch) {
            customDataFile = customDataFileMatch[1]
        }
    }
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/hyphae-lab/clb2h2e48000015o4w0b0tyig',
        center: customCenter ?? [-121.87209750161911, 41.648412869824384],
        zoom: customZoom ?? 6.5
    });

    function loadProjectTiles(project, parentFeatureId) {
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

                // remove feature whose sub-tiles were show
                tilesData['leaves'].features.forEach((feature, i) => {
                    if (feature.id === parentFeatureId) {
                        tilesData['leaves'].features.splice(i, 1)
                    }
                });
                console.log(tilesData)
                // update source
                sources['leaves'].setData(tilesData['leaves']); // update

                layersIds.push(project);
                map.addSource(project, {type: 'geojson', data});
                map.addLayer({
                    'id': project,
                    'type': 'fill',
                    'source': project,
                    "paint": {
                        "fill-color": "#aaaaff",
                        "fill-opacity": .9,
                        "fill-outline-color": "#0000aa"
                    }
                });
            })
    }

    let layersIds = [];
    let highlightLayerSource = null;
    let sources = {}

    const tilesData = {};

    function initMap() {
        const dataFile = customDataFile ? customDataFile : 'projects/leaves-status.json'
        fetch(dataFile)
            .then(response => response.json())
            .then(data => loadProjectsBboxes(data));
    }

    function loadProjectsBboxes(data) {
        tilesData['leaves'] = data;
        layersIds.push('leaves');
        if (!data.features[0].id) {
            data.features.forEach((feature, i) => {
                feature.id = (i + 1);
            })
        }
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
        highlightLayerSource = map.getSource('highlight')

        map.addSource('leaves', {type: 'geojson', data});
        sources['leaves'] = map.getSource('leaves')
        map.addLayer({
            'id': 'leaves',
            'type': 'fill',
            'source': 'leaves',
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

        map.on('click', onMapClick);
    }

    function onMapClick(clickEvent) {
        var features = map.queryRenderedFeatures(clickEvent.point, {layers: layersIds});
        console.log(features);

        if (!features.length) {
            highlightLayerSource.setData({type: 'FeatureCollection', features: []});
            return;
        }
        highlightLayerSource.setData({type: 'FeatureCollection', features: [features[0]]});
        renderPopover(features[0], clickEvent.lngLat)
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
<div><strong>Project TILES: <br/></strong> ${projectName}</div>
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
                loadProjectTiles(e.target.dataset.project, e.target.dataset.featureId)
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

    function initPopoverObject(html, popoverLngLat, onOpenCallback) {
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
            .setHTML(html)
            .setMaxWidth("300px")
        if (onOpenCallback) {
            popup.on('open', onOpenCallback);
        }
        popup.addTo(map)
    }

    map.on('load', initMap);
}