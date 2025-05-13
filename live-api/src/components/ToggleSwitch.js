import React, { useState } from 'react';

export default function ToggleSwitch(props) {
  const [isChecked, setIsChecked] = useState(false);

  const handleToggle = () => {
    if (props.disabled()) {
      return;
    }
    setIsChecked(!isChecked);
    if (isChecked) {
      props.setValue(props.labelLeft);
    } else {
      props.setValue(props.labelRight);
    }
  };

  return (
    <div className="
           relative w-44 h-10 rounded-full bg-purple-100
	   flex items-center p-1 shadow-inner">
      <input type="checkbox" id={props.id}
        className="sr-only peer"
        checked={isChecked} onChange={handleToggle} />

      <label htmlFor={props.id}
        className="absolute inset-0 cursor-pointer
	  flex justify-around items-center text-gray-700
	  font-semibold z-10">
        <span className={`flex-1 text-center transition-colors duration-300
            ${!isChecked ? 'text-blue-600' : ''} `}>
	  {props.labelLeft}
        </span>
        <span className={`flex-1 text-center transition-colors duration-300
            ${isChecked ? 'text-blue-600' : ''} `}>
	  {props.labelRight}
        </span>
      </label>

      <div className={`
             absolute top-1 w-1/2 h-8
             rounded-full shadow-md transition-all duration-300 ease-in-out
             ${isChecked ? 'right-1 left-auto' : 'left-1 right-auto'}
             ${props.disabled() ? 'bg-gray-200' : 'bg-white'}`}/>
    </div>
  );
};
