import React, {useState, useEffect} from 'react';
import ScrapedProject from './ScrapedProject';

const pageSize = 10;
const Source = ({model, isCurrent, onShow}) => {
    const onSourceClick = (e) => {
        console.log(model.id, isCurrent);
        e.preventDefault();
        onShow(model.id);
    }

    const [projects, setProjects] = useState(null);
    const [projectIds, setProjectIds] = useState(null);
    const [scrapedProjectIds, setScrapedProjectIds] = useState(null);
    const [projectIdsPaged, setProjectIdsPaged] = useState([]);
    const [isShow, setShow] = useState(false);
    useEffect(() => {
        if (!isCurrent) {
            setShow(false);
            return;
        }

        if (!projects) {
            console.log('fetching '+ model.id)
            fetch(`/sources/${model.id}`, {
                method: 'GET'
            }).then(resp => resp.json())
                .then(json => {
                    setProjects(json);
                })
        } else {
            console.log('already has '+model.id)
        }
        setShow(true);
    }, [isCurrent]);

    const [page, setPage] = useState(0);
    const [maxPages, setMaxPages] = useState(-1);
    useEffect(() => {
        if (!projects) {
            return;
        }

        Object.keys(projects.data).forEach(k => {
            projects.data[k].id = k;
        });
        const sortedIds = Object.keys(projects.data).sort((a, b)=> { return projects.data[a].dateModified > projects.data[b].dateModified ? 1 : -1; })
        setMaxPages(Math.ceil(sortedIds.length / pageSize));

        setProjectIds(sortedIds.filter(k => !projects.data[k].hasDownloads));
        setScrapedProjectIds(sortedIds.filter(k => !!projects.data[k].hasDownloads));
    }, [projects]);

    useEffect(() => {
        if (!projects) {
            return;
        }
        setProjectIdsPaged(projectIds.slice(page * pageSize, page * pageSize + pageSize));
    }, [projectIds, page]);


    const gotoPage = (direction) => {
        setPage(p => Math.max(0, Math.min(maxPages, p + direction)));
    };

    const [currentProjectId, setCurrentProjectId] = useState(null);

    return <div className='projects'>
        <h2><a href={`/sources/${model.id}`} onClick={onSourceClick} style={{fontSize: 'inherit'}}>{model.name}</a></h2>
        <div style={{display: isShow ? '':'none'}}>
            <h3>Scraped Projects</h3>
            {isCurrent && !!scrapedProjectIds &&
                scrapedProjectIds.map(id =>
                    <ScrapedProject
                        key={id} project={projects.data[id]}
                        onExpand={id => setCurrentProjectId(id)}
                        onCollapse={id => setCurrentProjectId(null)}
                        isExpanded={id === currentProjectId}/>
                )
            }
            <h3>All Projects</h3>
            <div><button disabled={page === 0} onClick={gotoPage.bind(null, -1)}>&lt;&lt; Prev</button>
                &nbsp;
                <button disabled={page === maxPages - 1} onClick={gotoPage.bind(null, 1)}>Next &gt;&gt;</button>
            </div>
            {isCurrent && !!projectIds &&
                projectIdsPaged.map(id =>
                    <div className={'project'} key={id}>{id} ({projects.data[id].dateModified})</div>)
            }
        </div>
    </div>;
};

export default Source;