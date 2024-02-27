const FakeMapboxglMap = {
    Map: function() {
        this.queryRenderedFeatures = () => [];
        this.on = (type, handler) => {
            if (type !== 'click') {
                handler();
            }
        };
        this.once = () => {};
        this.off = () => {};
        this.project = () => {};
        this.unproject = () => {};
        this.getCanvas = () => { return document.createElement('span')};
        this.getZoom = () => {};
        this.getCenter = () => {};
        this.flyTo = () => {};
        this.addLayer = () => {};
        this.addSource = () => {};
        this.getSource = () => { return { setData: () => {} }; };
        this.setPaintProperty = () => {};
    }
}
const FakeMapboxDraw = function() {
    this.onAdd = () => {};
    this.changeMode = () => {};
    this.getAll = () => {};
    this.deleteAll = () => {};
}