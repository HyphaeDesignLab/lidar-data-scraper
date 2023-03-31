import React, {useState, useEffect} from 'react';

const Source = ({model, isCurrent, onShow}) => {
    const onSourceClick = (e) => {
        console.log(model.id, isCurrent);
        e.preventDefault();
        onShow(model.id);
    }

    const [projectData, setProjectData] = useState(null);
    const [projects, setProjects] = useState(null);
    const [projectsFiltered, setProjectsFiltered] = useState(null);
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

    useEffect(() => {
        if (!projectData) {
            return;
        }

        const sortedKeys = Object.keys(projectData.data).sort((a,b)=> { return projectData.data[a].dateModified > projectData.data[b].dateModified ? 1 : -1; })
        const sorted = sortedKeys.map(k => { projectData.data[k].id = k; return projectData.data[k]; });
        setProjects(sorted);
        setProjectsFiltered(sorted.slice(0, 10));
        console.log(sorted.slice(0, 10), sorted);
    }, [projectData]);

    return <div>
        <a href={`/sources/${model.id}`} onClick={onSourceClick}>{model.name}</a>
        <div style={{display: isShow ? '':'none'}}>
        {isCurrent && !!projectsFiltered &&
            projectsFiltered.map(project =>
                <div className={'project'} key={project.id}>{project.id} ({project.dateModified})</div>)
        }
        </div>
    </div>;
};

export default Source;