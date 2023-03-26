import React, {useState, useEffect, useRef} from "react";

import { humanReadableTitle } from './../helpers.js';

const EditIcon = () => {
    return <svg style={{height: '15px'}} version="1.1" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="m59.875 5.0312c-1.6133 0.039062-3.1875 0.875-4.0312 2.3438l-34.031 59.375c-0.22266 0.40234-0.35156 0.85156-0.375 1.3125l-1.4375 23.75c-0.070312 1.1367 0.50781 2.2188 1.4961 2.7891 0.98438 0.57031 2.2109 0.53125 3.1602-0.10156l19.75-13.125c0.38672-0.25781 0.70703-0.59766 0.9375-1l34.031-59.344c1.2852-2.2422 0.48828-5.1992-1.75-6.5l-15.281-8.875c-0.55859-0.32422-1.168-0.51953-1.7812-0.59375-0.23047-0.027344-0.45703-0.035156-0.6875-0.03125zm0.5625 6.4688 13.125 7.5938-4.0312 7.0312-13.125-7.5938zm-7 12.219 13.094 7.5938-24.906 43.438-13.125-7.5938zm-26.312 49.562 9.9375 5.75-10.719 7.125z"/>
    </svg>;
};
const minInputWidth = 30;

export default function InputString({value=null, path, onSave, type='text',
                                        hasLabel=true, isOnlyEditMode=false, onCancel=null,
                                        inputStyle= {}, wrapEl=null}) {
    const [newValue, setNewValue] = useState(value);
    const [oldValue, setOldValue] = useState(value);
    useEffect(() => {
        setOldValue(value);
        setNewValue(value);
    }, [value]);

    const [isChanged, setIsChanged] = useState(false);
    useEffect(() => {
        setIsChanged(newValue !== oldValue);
    }, [oldValue, newValue]);

    const inputRef = useRef(null);

    const [isEditable, setEditable] = useState(isOnlyEditMode);
    useEffect(() => {
        if (!inputRef.current) {
            return;
        }
        if (isEditable) {
            inputRef.current.focus();
        }
    }, [isEditable, inputRef]);

    const handleEditClick = e => {
        setEditable(true);
    }

    const resetValue = () => {
        if (!isOnlyEditMode) {
            setEditable(false);
        }

        setNewValue(oldValue);

        if (onCancel) {
            onCancel();
        }
    }
    const handleKeyUp = e => {
        if (e.code === 'Escape') {
            resetValue();
        }
    }
    const handleCancelClick = e => {
        e.preventDefault();
        resetValue();
    }

    const handleChange = e => {
        if (e.target.value === null) {
            setNewValue('');
            return;
        }
        if (type === 'number') {
            const value = parseFloat(e.target.value);
            if (isNaN(value)) {
                setNewValue('');
                return;
            }
            setNewValue(value);
        } else if (type === 'longtext') {
            setNewValue(String(e.target.value).replaceAll("\n", '~'));
        } else {
            setNewValue(String(e.target.value));
        }
    };

    const handleSaveClick = () => {
        // e.g. name=style or center.0  center.1  or someProps.nestedProp
        onSave( {[path]: newValue} );
        setOldValue(newValue);
        setEditable(false);
    };


    const measureTextLengthElRef = useRef(null);
    const [inputLength, setInputLength] = useState('auto');
    useEffect(() => {
        if (type === 'longtext') {
            return;
        }
        let width = parseInt(window.getComputedStyle(measureTextLengthElRef.current).width) * 1.1;
        setInputLength(width+'px');
    }, [newValue]);

    const WrappingTag = wrapEl ? wrapEl : 'div';
    return (<React.Fragment>
        <WrappingTag>
            {hasLabel && !!path && <strong>{humanReadableTitle(path)}: </strong>}
            {isEditable ?
                type === 'longtext' ?
                <textarea
                    ref={inputRef}
                    value={newValue.replaceAll('~', "\n")}
                    onChange={handleChange}
                    style={{minWidth: '350px', minHeight: '200px', ...inputStyle}}
                ></textarea> :
                <input type={type}
                       ref={inputRef}
                       value={newValue}
                       onChange={handleChange}
                       onKeyUp={handleKeyUp}
                       style={{width: inputLength, minWidth: '60px', ...inputStyle}} />
                :
                <span onClick={handleEditClick} style={{whiteSpace: 'pre', ...inputStyle}}>
                    {!oldValue ? '--empty--' : (type === 'longtext' ? oldValue.replaceAll('~', "\n") : oldValue)} <EditIcon />
                </span>
            }
            {isChanged && <span>&nbsp;<button onClick={handleSaveClick}>save</button></span>}
            {(isOnlyEditMode && isChanged) || (!isOnlyEditMode && isEditable) &&
                <span>&nbsp;<button className='link' onClick={handleCancelClick}>cancel</button></span>
            }
        </WrappingTag>
        <WrappingTag className='measure-text-length-offpage' ref={measureTextLengthElRef} style={{...inputStyle}}>{newValue}</WrappingTag>
    </React.Fragment>);
};