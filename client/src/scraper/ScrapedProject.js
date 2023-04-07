import React, {useState, useEffect} from 'react';

const ScrapedProject = ({sourceId, project, isExpanded, onExpand, onCollapse}) => {
    const [data, setData] = useState(null);
    const [isLoading, setLoading] = useState(false);

    useEffect(() => {
        if (isExpanded && !data) {
            console.log('getting scraped project data');

            setLoading(true);
            fetch(`/source/${sourceId}/${project.id}/get`, {
                method: 'GET'
            }).then(resp => resp.json())
                .then(json => {
                    if (!!json.subprojects) {
                        Object.keys(json.subprojects).forEach(k => {
                            json.subprojects[k].id = k;
                        })
                    }
                    setData(json);
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
    return (
        <div>
            {!isExpanded ?
                <div>
                    <h4 className='link' onClick={onExpandClick}>{project.id} </h4>
                    <div>
                        {!!project.dateScraped ?
                            <span style={{color: '#a33'}}>last scraped on {project.dateScraped} ::  modified by USGS on {project.dateMofified}</span>
                            :
                            <span>project never been scraped</span>
                        }
                    </div>
                </div>
                :
                <h4>{project.id} ({project.dateModified})
                    <span className='link' style={{fontSize: '80%'}} onClick={onCollapseClick}>close</span>
                </h4>
            }
            {isExpanded && <div>
                {isLoading && <div><span className='spinning-loader'></span> loading</div>}
                {!!data && <div>
                    {!!data.subprojects && <div>
                        <h5>Sub-projects</h5>
                        {Object.keys(data.subprojects).map(subprojectId =>
                            <ScrapedProject
                                key={subprojectId}
                                sourceId={sourceId}
                                project={data.subprojects[subprojectId]}
                                onExpand={id => setCurrentSubprojectId(subprojectId)}
                                onCollapse={id => setCurrentSubprojectId(null)}
                                isExpanded={subprojectId === currentSubprojectId}/>
                        )}
                    </div>}
                </div>}
            </div>}

        </div>
    );
};

export default ScrapedProject;