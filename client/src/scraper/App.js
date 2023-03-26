import React, {useState, useEffect, useRef} from 'react';

const App = () => {
    const [scrape, setScrape] = useState({});
    useEffect(() => {
        fetch('test.json', {
            method: 'GET'
        }).then(resp => resp.json())
            .then(json => {
                setScrape(json);
            })
    }, []);
    return (
        <div className='app'>
            <h1>Lidar Scraper App</h1>
            <main>
                {JSON.stringify(scrape)}
            </main>
        </div>
    );
};

export default App;