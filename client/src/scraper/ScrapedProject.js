import React, {useState, useEffect} from 'react';

const ScrapedProject = ({project, isExpanded, onExpand, onCollapse}) => {
    const onExpandClick = e => {
        onExpand(project.id);
    }
    const onCollapseClick = e => {
        onCollapse(project.id);
    }
    return (
        <div>
            {!isExpanded ?
                <span className='link' onClick={onExpandClick}>{project.id} ({project.dateModified})</span>
                :
                <h4>{project.id} ({project.dateModified})
                    <span className='link' style={{fontSize: '80%'}} onClick={onCollapseClick}>close</span>
                </h4>
            }
            {isExpanded && <div>
                list of scrape tiles (meta data)
            </div>}

        </div>
    );
};

export default ScrapedProject;