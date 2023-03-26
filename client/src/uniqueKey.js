export default function addUniqueKey (item) {
    if ((item instanceof Object)) {
        if (!item.uniqueKeyReactMap) {
            Object.defineProperty(item, 'uniqueKeyReactMap', {
                enumerable: false,
                writable: false,
                value: Math.floor(Math.random() * 1000 * 1000 * 1000).toString(16)
            });
        }

        return item.uniqueKeyReactMap;
    } else {
        return item;
    }
}