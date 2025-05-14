import React, { useState } from 'react';

const Dropdown = (props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);

  const handleToggle = () => {
    if (props.disabled()) {
      return;
    }      
    setIsOpen(!isOpen);
  };

  const handleSelect = (option) => {
    setSelectedOption(option);
    props.onSelect(option);
    setIsOpen(false);
  };

  const activeStyle = `hover:bg-gray-50 focus:outline-none
                       focus:ring-2 focus:ring-offset-2
                       focus:ring-indigo-500 bg-white`;
  return (
    <div className="relative inline-block text-left">
      <div>
        <button type="button"
                className={`inline-flex justify-left w-fill
                           rounded-md border border-gray-300
                           shadow-sm px-4 py-2
                           font-semibold text-gray-700
                           ${props.disabled() ? 'bg-gray-300' : activeStyle}`}
                id="options-menu"
                aria-haspopup="true"
                aria-expanded="true"
                onClick={handleToggle} >
          {selectedOption ? selectedOption.label : props.placeholder}
          <svg className="-mr-1 ml-2 h-5 w-5"
               xmlns="http://www.w3.org/2000/svg"
               viewBox="0 0 20 20"
               fill="currentColor"
               aria-hidden="true" >
            <path fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-fill z-10
                        rounded-md shadow-lg bg-white
                        ring-1 ring-black ring-opacity-5
                        focus:outline-none"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="options-menu" >
          <div className="py-1" role="none">
            {props.options.map((option) => (
              <a key={option.value}
                 href="#"
                 className="block px-4 py-2 font-semibold text-gray-700
                            hover:bg-gray-100 hover:text-gray-900"
                 role="menuitem"
                 onClick={(e) => {
                   e.preventDefault();
                   handleSelect(option);
                 }} >
                {option.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;
