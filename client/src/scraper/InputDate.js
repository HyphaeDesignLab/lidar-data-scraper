import React, {useState, useEffect, useRef} from "react";
import {humanReadableTitle} from "../helpers";

const EditIcon = () => {
    return <svg style={{height: '15px'}} version="1.1" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="m59.875 5.0312c-1.6133 0.039062-3.1875 0.875-4.0312 2.3438l-34.031 59.375c-0.22266 0.40234-0.35156 0.85156-0.375 1.3125l-1.4375 23.75c-0.070312 1.1367 0.50781 2.2188 1.4961 2.7891 0.98438 0.57031 2.2109 0.53125 3.1602-0.10156l19.75-13.125c0.38672-0.25781 0.70703-0.59766 0.9375-1l34.031-59.344c1.2852-2.2422 0.48828-5.1992-1.75-6.5l-15.281-8.875c-0.55859-0.32422-1.168-0.51953-1.7812-0.59375-0.23047-0.027344-0.45703-0.035156-0.6875-0.03125zm0.5625 6.4688 13.125 7.5938-4.0312 7.0312-13.125-7.5938zm-7 12.219 13.094 7.5938-24.906 43.438-13.125-7.5938zm-26.312 49.562 9.9375 5.75-10.719 7.125z"/>
    </svg>;
};

const isDateInDaylightSavings = (date, timezone) => {
    const year = date.getFullYear();
    var january = new Date(`${year}-01-01 12:00:00 ${timezone}`);
    var july = new Date(`${year}-07-01 12:00:00 ${timezone}`);
    const stdTimezoneOffset = Math.max(january.getTimezoneOffset(), july.getTimezoneOffset());

    return date.getTimezoneOffset() < stdTimezoneOffset;
}

const isLeapYear = year => {
    return new Date(year+'-02-29').getUTCDate() === 29;
}
const getMonthsDaysOfYear = year => [31, isLeapYear(year) ? 29:28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const timezones = ['PST', 'MST', 'CST', 'EST'];
const timezonesOffset = ['-8 hrs', '-7 hrs', '-6 hrs', '-5 hrs'];

const hoursAmPm = [12,1,2,3,4,5,6,7,8,9,10,11,12,1,2,3,4,5,6,7,8,9,10,11];
const hours = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
const minutes = [];
for(let i=0;i<60; i++) {minutes.push(i);}

const getAmPm = hour => {

}
const now = new Date();
export default function InputDate({value=null, path, onSave,
                                        hasLabel=true,
                                        isOnlyEditMode=false, onCancel=null,
                                        inputStyle= {}, wrapEl=null,
                                  startDate=null, endDate=null}) {

    const [newValue, setNewValue] = useState(value);
    const [oldValue, setOldValue] = useState(value);

    const [yearValue, setYearValue] = useState(value.getFullYear());
    const [monthValue, setMonthValue] = useState(value.getMonth());
    const [dateValue, setDateValue] = useState(value.getDate());
    const [hourValue, setHourValue] = useState(value.getHours());
    const [minuteValue, setMinuteValue] = useState(value.getMinutes());
    const [timezoneValue, setTimezoneValue] = useState(timezones[0]);
    const [isDaylightSavings, setDaylightSavings] = useState(isDateInDaylightSavings(value, timezones[0]));
    const [isShowDaylightSavings, showDaylightSavings] = useState(false);

    useEffect(() => {
        setOldValue(value);
        setNewValue(value);
    }, [value]);

    const years = useRef([]);
    useEffect(() => {
        let startYear = 0;
        if (!startDate) {
            startYear = now.getFullYear() - 5;
        } else {
            startYear = new Date(startDate).getFullYear();
        }
        let endYear = 0;
        if (!endDate) {
            endYear = now.getFullYear() + 5;
        } else {
            endYear = new Date(endDate).getFullYear();
        }
        for (let i=startYear; i<=endYear; i++) {
            years.current.push(i);
        }
    }, []);

    const [datesInMonth, setDatesInMonth] = useState([]);
    useEffect(() => {
        const datesInMonth_ = [];
        const lastDayOfMonth = [31, isLeapYear(yearValue) ? 29:28, 31, 30, 31, 30,
         31, 31, 30, 31, 30, 31][monthValue];
        for(let i=1; i<=lastDayOfMonth; i++) {
            datesInMonth_.push(i);
        }
        setDatesInMonth(datesInMonth_);
    }, [yearValue, monthValue]);

    useEffect(() => {
        const date = new Date(`${yearValue}-${monthValue+1}-${dateValue} ${hourValue}:${minuteValue}:00 ${timezoneValue}`)
        setDaylightSavings(isDateInDaylightSavings(date, timezoneValue))
        setNewValue(date);
    }, [yearValue, monthValue, dateValue, hourValue, minuteValue, timezoneValue]);


    const [isChanged, setIsChanged] = useState(false);
    useEffect(() => {
        setIsChanged(newValue.getTime() !== oldValue.getTime());
    }, [oldValue, newValue]);

    const [isEditable, setEditable] = useState(isOnlyEditMode);

    const handleEditClick = e => {
        setEditable(true);
    }

    const resetValue = () => {
        if (!isOnlyEditMode) {
            setEditable(false);
        }

        setNewValue(oldValue);

        setYearValue(oldValue.getFullYear());
        setMonthValue(oldValue.getMonth());
        setDateValue(oldValue.getDate());

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

    const handleYearChange = e => {
        const yearValue_ = parseInt(e.target.value);
        setYearValue(yearValue_);
        const months = getMonthsDaysOfYear(yearValue_);
        if (dateValue > months[monthValue]) {
            setDateValue(months[monthValue]);
        }
    };
    const handleMonthChange = e => {
        const monthValue_ = parseInt(e.target.value);
        setMonthValue(monthValue_);
        const months = getMonthsDaysOfYear(yearValue);
        if (dateValue > months[monthValue_]) {
            setDateValue(months[monthValue_]);
        }
    };

    const handleDateChange = e => {
        setDateValue(parseInt(e.target.value));
    };
    const handleHourChange = e => {
        setHourValue(parseInt(e.target.value));
    };
    const handleMinuteChange = e => {
        setMinuteValue(parseInt(e.target.value));
    };
    const handleTimezoneChange = e => {
        setTimezoneValue(e.target.value);
    };

    const handleSaveClick = () => {
        // e.g. name=style or center.0  center.1  or someProps.nestedProp
        onSave( {[path]: newValue} );
        setOldValue(newValue);
        setEditable(false);
    };

    const [isShowUTCTime, setShowUTCTime] = useState(false);

    const WrappingTag = wrapEl ? wrapEl : 'div';
    return (<React.Fragment>
        <WrappingTag>
            {hasLabel && !!path && <strong>{humanReadableTitle(path)}: </strong>}
            {isEditable ?
                <React.Fragment>
                <select
                       value={yearValue}
                       onChange={handleYearChange}
                       onKeyUp={handleKeyUp}
                >
                    {years.current.map(year => <option key={year}>{year}</option>)}
                </select>
                <select
                       value={monthValue}
                       onChange={handleMonthChange}
                       onKeyUp={handleKeyUp}
                >
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) =>
                        <option value={i} key={month}>{month}</option>)}
                </select>
                <select
                       value={dateValue}
                       onChange={handleDateChange}
                       onKeyUp={handleKeyUp}
                >
                    {datesInMonth.map(day =>
                        <option value={day} key={day}>{day}</option>)}
                </select>
                    &nbsp;
                <span style={{position: 'relative', color: isDaylightSavings ? 'red':'inherit'}}>
                    {isDaylightSavings && isShowDaylightSavings &&
                        <span style={{
                            position: 'absolute',
                            left: 0, top: '100%',
                            zIndex: 100,
                            width: '300px',
                            borderRadius: '5px', border: '1px dashed grey',
                            backgroundColor: 'white'}}>* time will appear as 1 hour later, this date falls in "daylight savings" months</span>
                    }{isDaylightSavings && <span style={{cursor: 'help'}} onClick={() => showDaylightSavings(s => !s)}>(?)</span>}
                    <select
                       value={hourValue}
                       onChange={handleHourChange}
                       onKeyUp={handleKeyUp}
                       style={{color: 'inherit'}}
                >
                    {Object.keys(hours).map(hour =>
                        <option value={hour} key={hour}>{hoursAmPm[hour]}</option>)}
                </select></span>

                <select
                       value={minuteValue}
                       onChange={handleMinuteChange}
                       onKeyUp={handleKeyUp}
                >
                    {minutes.map(minute =>
                        <option value={minute} key={minute}>{minute < 10 && '0'}{minute}</option>)}
                </select>

                {hourValue > 11 ? 'pm':'am'}
                    &nbsp;
                <select
                       value={timezoneValue}
                       onChange={handleTimezoneChange}
                       onKeyUp={handleKeyUp}
                >
                    &nbsp;
                    {timezones.map((timezone,i) =>
                        <option value={timezone} key={timezone}>{timezone} ({timezonesOffset[i]})</option>)}
                </select>
                </React.Fragment>
                :
                <React.Fragment>
                    <span onClick={handleEditClick} style={{whiteSpace: 'pre', ...inputStyle}}>
                        {value.toLocaleString('en-US', {timeZone: timezoneValue, dateStyle: 'medium', timeStyle: 'long'})}
                        {isDateInDaylightSavings(value, timezoneValue) > 0 ? ' (daylight savings)' : ''} <EditIcon />
                    </span>
                    &nbsp;
                    <span style={{textDecoration: 'underline', cursor: 'pointer'}} onClick={() => setShowUTCTime(c => !c)}>utc{isShowUTCTime ? ':':'?'}</span>
                    {isShowUTCTime && <span> {value.toUTCString()}</span>}
                </React.Fragment>
            }
            {isChanged && <span>&nbsp;<button onClick={handleSaveClick}>save</button></span>}
            {(isOnlyEditMode && isChanged) || (!isOnlyEditMode && isEditable) &&
                <span>&nbsp;<button className='link' onClick={handleCancelClick}>cancel</button></span>
            }
        </WrappingTag>
    </React.Fragment>);
};