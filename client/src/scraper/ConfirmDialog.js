import React from 'react';

const ConfirmDialog = ({
                           onCancel, // required
                           title = '',
                           text = '',
                           confirmText = 'Confirm',
                           cancelText = 'Cancel',
                           onConfirm = () => {},
                           children
                       }) => {
    return <div className='overlay-wrap'>
        <div className='overlay-text'>
            <span className='overlay-close' aria-label={`close dialog ${title}`} onClick={onCancel}>X</span>
            {!!children ?
                children :
                <React.Fragment>
                    <h3>{title}</h3>
                    <p>{text}</p>
                    <div>
                        <button type='button' onClick={onConfirm}>{confirmText}</button>
                        &nbsp;
                        <button type='button' className='link' onClick={onCancel}>{cancelText}</button>
                    </div>
                </React.Fragment>
            }
        </div>
    </div>
};

export default ConfirmDialog;