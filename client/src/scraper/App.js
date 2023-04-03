import React, {useState, useEffect, useRef} from 'react';
import Source from './Source';

const App = () => {
    const [sources, setSources] = useState({});
    const [currentSourceId, setCurrentSourceId] = useState(null);

    const [isLoading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        fetch('/sources', {
            method: 'GET'
        }).then(resp => resp.json())
            .then(json => {
                Object.keys(json).forEach(id => json[id].id = id );
                setSources(json);
        }).finally(() => {
            setLoading(false);
        })
    }, []);


    return (
        <div className='app'>
            <h1>Lidar Scraper App</h1>
            <main>
                {isLoading && <div>Loading data... <span className='spinning-loader'></span></div>}
                {Object.keys(sources).map(id =>
                    <Source key={id} model={sources[id]} isCurrent={currentSourceId === id} onShow={id => setCurrentSourceId(id)} />
                )}
            </main>
        </div>
    );
};

export default App;