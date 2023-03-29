import React, {useState, useEffect} from 'react';

const Source = ({data, isCurrent, onShow}) => {
    const onSourceClick = (e) => {
        console.log(data.id, isCurrent);
        e.preventDefault();
        onShow(data.id);
    }

    const [projects, setProjects] = useState(null);
    const [isShow, setShow] = useState(false);
    useEffect(() => {
        if (!isCurrent) {
            setShow(false);
            return;
        }

        if (!projects) {
            console.log('fetching '+ data.id)
            fetch(`/sources/${data.id}`, {
                method: 'GET'
            }).then(resp => resp.json())
                .then(json => {
                    setProjects(json);
                })
        } else {
            console.log('already has '+data.id)
        }
        setShow(true);
    }, [isCurrent]);


    return <div>
        <a href={`/sources/${data.id}`} onClick={onSourceClick}>{data.name}</a>
        <div style={{display: isShow ? '':'none'}}>
        {isCurrent && !!projects &&
            Object.keys(projects).map(id =>
                <div className={'project'} key={id}>{id} ({projects[id]}</div>)
        }
        </div>
    </div>;
};

export default Source;