import React, {useState, useEffect} from 'react';

const pageSize = 10;
const Source = ({model, isCurrent, onShow}) => {
    const onSourceClick = (e) => {
        console.log(model.id, isCurrent);
        e.preventDefault();
        onShow(model.id);
    }

    const [projectData, setProjectData] = useState(null);
    const [projects, setProjects] = useState(null);
    const [projectsPaged, setProjectsPaged] = useState(null);
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
                    setProjectData(json);
                })
        } else {
            console.log('already has '+model.id)
        }
        setShow(true);
    }, [isCurrent]);

    const [page, setPage] = useState(0);
    const [maxPages, setMaxPages] = useState(-1);
    useEffect(() => {
        if (!projectData) {
            return;
        }

        const sortedKeys = Object.keys(projectData.data).sort((a,b)=> { return projectData.data[a].dateModified > projectData.data[b].dateModified ? 1 : -1; })
        const sorted = sortedKeys.map(k => { projectData.data[k].id = k; return projectData.data[k]; });
        setProjects(sorted);
        setMaxPages(Math.ceil(sorted.length / pageSize));
    }, [projectData]);

    useEffect(() => {
        if (!projects) {
            return;
        }
        setProjectsPaged(projects.slice(page * pageSize, page * pageSize + pageSize));
    }, [projects, page]);

    const gotoPage = (direction) => {
        setPage(p => Math.max(0, Math.min(maxPages, p + direction)));
    };
    return <div>
        <a href={`/sources/${model.id}`} onClick={onSourceClick}>{model.name}</a>
        <div style={{display: isShow ? '':'none'}}>
            <div><button disabled={page === 0} onClick={gotoPage.bind(null, -1)}>&lt;&lt; Prev</button>
                &nbsp;
                <button disabled={page === maxPages - 1} onClick={gotoPage.bind(null, 1)}>Next &gt;&gt;</button>
            </div>
            {isCurrent && !!projectsPaged &&
                projectsPaged.map(project =>
                    <div className={'project'} key={project.id}>{project.id} ({project.dateModified})</div>)
            }
        </div>
    </div>;
};

export default Source;