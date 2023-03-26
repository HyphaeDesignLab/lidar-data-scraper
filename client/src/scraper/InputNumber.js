import React, {useState, useEffect} from "react";

export default function InputNumber({value, name, onSave}) {
    const [isEditable, setEditable] = useState(false);
    const [num, setNum] = useState(value);
    useEffect(() => {
        setNum(value);
    }, [value]);
    const handleEditClick = e => {
        setEditable(s => !s);
    }
    const handleCancelClick = e => {
        e.preventDefault();
        setEditable(false);
        setNum(value);
    }
    const handleSaveClick = e => {
        onSave( {[name]: num} );
        setEditable(false);
    }
    const handleChange = e => {
        console.log(e.target.value);
        setNum(e.target.value);
    }
    const handleKeyUp = e => {
      if (e.code === 'Escape') {
          setEditable(false);
          setNewValue(oldValue);
      }
  }

    return (
        <div>
            {!!name && <strong>{name}: </strong>}
            {isEditable ?
                <span>
                    <input type='number' value={num} onChange={handleChange}/>
                    <a href='#' onClick={handleCancelClick}>cancel</a>
                    <a href='#' onClick={handleSaveClick}
                    onKeyUp={handleKeyUp}>save</a>
                </span>
                :
                <span onClick={handleEditClick}>{num}</span>
            }
        </div>
    );
};