const FakeMapboxglMap = {
    Map: function() {
        this.queryRenderedFeatures = () => [];
        this.on = () => {};
        this.once = () => {};
        this.off = () => {};
        this.project = () => {};
        this.unproject = () => {};
        this.getCanvas = () => {};
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