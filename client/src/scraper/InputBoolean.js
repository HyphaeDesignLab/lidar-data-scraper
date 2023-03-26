import React, {useState, useEffect} from "react";


import { humanReadableTitle } from './../helpers.js';

export default function InputBoolean({value, path, onSave}) {
    const [isEditable, setEditable] = useState(false);
    const [internalValue, setInternalValue] = useState(value);

    const onChangeHandler = () => {
        setInternalValue(!internalValue);
    };

    const onSaveHandler = () => {
        onSave( {[path]: internalValue} );
        setEditable(false);
    };

    const handleEditClick = e => {
        setEditable(s => !s);
    }
    const onCancelHandler = e => {
        e.preventDefault();
        setEditable(false)
    }
    return (
        <div>
            {!!path && <strong>{humanReadableTitle(path)}: </strong>}
            {isEditable ?
                <span>
                    <button disabled={internalValue} onClick={onChangeHandler}>Yes</button>
                    <button disabled={!internalValue} onClick={onChangeHandler}>No</button>
                    <a href='#' onClick={onCancelHandler}>cancel</a>
                    <a href='#' onClick={onSaveHandler}>save</a>
                </span>
                :
                <span onClick={handleEditClick}>{value ? 'yes':'no'}</span>
            }
        </div>
    );
};