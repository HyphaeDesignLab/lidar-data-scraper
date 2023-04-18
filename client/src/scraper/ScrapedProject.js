import React, {useState, useEffect} from 'react';

const scrpedDivStyle = {maxHeight: '270px', overflow: 'scroll', border: '1px dashed grey', padding: '5px'};
const ScrapedProject = ({source, project, isExpanded, onExpand, onCollapse}) => {
    const [subprojects, setSubprojects] = useState(null);
    const [data, setData] = useState(null);
    const [meta, setMeta] = useState(null);
    const [isLoading, setLoading] = useState(false);

    const [baseUrl, setBaseUrl] = useState('');
    useEffect(() => {
        if (source && project) {
            const urlArr = [source.baseUrl, project.parentId, project.id];
            setBaseUrl(urlArr.filter(i => i).join('/'));
        }
    }, [source, project]);
    useEffect(() => {
        if (isExpanded && !data) {
            console.log('getting scraped project data');

            setLoading(true);
            let projectIdInUrl = project.id;
            if (project.parentId) {
                projectIdInUrl = project.parentId + '/' + project.id;
            }
            fetch(`/source/${source.id}/${projectIdInUrl}/get`, {
                method: 'GET'
            }).then(resp => resp.json())
                .then(json => {
                    if (!!json.subprojects) {
                        Object.keys(json.subprojects).forEach(k => {
                            json.subprojects[k].id = k;
                            json.subprojects[k].parentId = project.id;
                        });
                        setSubprojects(json.subprojects);
                    }
                    if (!!json.data) {
                        setData(json.data);
                    }
                    setMeta(Object.fromEntries(Object.entries(json).filter(e => e[0] !== 'data' && e[0] !== 'subprojects')));
                }).finally(() => {
                setLoading(false);
            });

        }
    }, [isExpanded, data]);

    const onExpandClick = e => {
        onExpand(project.id);
    }

    const onCollapseClick = e => {
        onCollapse(project.id);
    }

    const [currentSubprojectId, setCurrentSubprojectId] = useState(null);

    const [dataCounts, setDataCounts] = useState({});
    const [scrapedOkIds, setScrapedOkIds] = useState([]);
    const [scrapedFailedIds, setScrapedFailedIds] = useState([]);
    useEffect(() => {
        if (!data) {
            return;
        }
        const dataIds = Object.keys(data);
        const scrapedIds = dataIds.filter(k => data[k].dateScraped);
        setScrapedOkIds(scrapedIds.filter(k => data[k].scrapedStatus === 'success'));
        const scrapedFailedIds = scrapedIds.filter(k => data[k].scrapedStatus !== 'success');
        setScrapedFailedIds(scrapedFailedIds);
        setDataCounts({
            total: dataIds.length,
            scraped: scrapedIds.length,
            scrapedOk: scrapedIds.length - scrapedFailedIds.length,
            scrapedFailed: scrapedFailedIds.length,
            notScraped: dataIds.length - scrapedIds.length
        });
    }, [data]);

    return (
        <div>
            <h4>{project.id} </h4>
            {!!dataCounts && <div>Total data tiles: {dataCounts.total} total, {dataCounts.scrapedOk} scraped, {dataCounts.scrapedFailed} scrape failed, {dataCounts.total - dataCounts.scraped} NOT scraped yet</div>}
            <div>
                list modified (remotely by USGS) on {project.dateModified}{' '}
                {!!project.dateScraped ?
                    <span style={{color: '#3a3'}}>last scraped on {project.dateScraped}  </span>
                    :
                    <span style={{color: '#a33'}}>project never been scraped</span>
                }

            </div>
            {!isExpanded ?
                <button onClick={onExpandClick}>See details</button>
                :
                <span className='link' onClick={onCollapseClick}>(X) hide details</span>}

            {isExpanded && <div>
                {isLoading && <div><span className='spinning-loader'></span> loading</div>}
                {!!subprojects ? <div>
                    <h5>Sub-projects</h5>
                    {Object.keys(subprojects).sort((a,b) => subprojects[a].dateScraped < subprojects[b].dateScraped ? 1:-1).map(subprojectId =>
                        <ScrapedProject
                            key={subprojectId}
                            source={source}
                            project={subprojects[subprojectId]}
                            onExpand={id => setCurrentSubprojectId(id)}
                            onCollapse={id => setCurrentSubprojectId(null)}
                            isExpanded={subprojectId === currentSubprojectId}/>
                    )}
                </div>:<div>
                    {!!dataCounts && <div>Total data tiles: {dataCounts.total} total, {dataCounts.scrapedOk} scraped, {dataCounts.scrapedFailed} scrape failed, {dataCounts.total - dataCounts.scraped} NOT scraped yet</div>}
                    {!!scrapedOkIds && <div>Scraped OK ({scrapedOkIds.length})</div>}
                    {!!scrapedOkIds && <div style={scrpedDivStyle}>
                        {scrapedOkIds.map(id => <div key={id}>
                            {id.replace(project.id, '').replace(project.parentId, '').replace(source.commonFileNamePrefix, '').replace(/^_/, '')}
                            {' '}
                            modified: {data[id].dateModified}
                            {' '}
                            scraped: {data[id].dateScraped} (status: {data[id].scrapedStatus})
                            {' '}
                            <a href={baseUrl + '/metadata/' + id + '.xml'} target='_blank'>full url</a>
                        </div>)}
                    </div>}
                    {!!scrapedFailedIds && <div>Scraped Failed ({scrapedFailedIds.length})</div>}
                    {!!scrapedFailedIds && <div style={scrpedDivStyle}>
                        {scrapedFailedIds.map(id => <div key={id}>
                            {id.replace(project.id, '').replace(project.parentId, '').replace(source.commonFileNamePrefix, '').replace(/^_/, '')}
                            {' '}
                            modified: {data[id].dateModified}
                            {' '}
                            scraped: {data[id].dateScraped} (status: {data[id].scrapedStatus})
                            {' '}
                            <a href={baseUrl + '/metadata/' + id + '.xml'} target='_blank'>full url</a>
                        </div>)}
                    </div>}
                </div>}
            </div>}

        </div>
    );
};

export default ScrapedProject;