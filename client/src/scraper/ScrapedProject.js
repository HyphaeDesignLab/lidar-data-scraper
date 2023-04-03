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
                <div>
                    <h4 className='link' onClick={onExpandClick}>{project.id} </h4>
                    <div>
                        {!!project.dateScraped ?
                            (
                                project.dateModified > project.dateScraped ?
                                    <span style={{color: '#a33'}}>project data out of date (last scraped on {project.dateScraped}, BUT modified by USGS on {project.dateMofified})</span> :
                                    <span style={{color: '#3a3'}}>project data up to date (last scraped on {project.dateScraped}, modified by USGS on {project.dateMofified}))</span>
                            )
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
                list of scrape tiles (meta data)
            </div>}

        </div>
    );
};

export default ScrapedProject;