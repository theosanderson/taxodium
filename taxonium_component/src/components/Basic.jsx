import classNames from "classnames";
import React from "react";

export const Modal = ({ isOpen, onClose, onConfirm, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <p className="text-sm text-gray-700">{message}</p>
          <div className="flex justify-center mt-4 gap-4">
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Yes
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Button = ({
  onClick,
  className,
  children,
  title,
  href,
  target,
}) => {
  if (href && onClick) {
    throw new Error("Button cannot have both href and onClick");
  }
  if (href) {
    return (
      <a
        className={classNames(
          "tx-button no-underline",
          "border border-gray-400 shadow-sm rounded py-1 px-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700",
          className
        )}
        href={href}
        title={title}
        target={target}
      >
        {children}
      </a>
    );
  } else {
    return (
      <button
        className={classNames(
          "tx-button",
          "border border-gray-400 shadow-sm rounded py-1 px-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700",
          className
        )}
        onClick={onClick}
        title={title}
      >
        {children}
      </button>
    );
  }
};

export const Select = ({ onChange, className, children, value, title }) => {
  return (
    <select
      className={classNames(
        "border bg-white text-gray-900 text-sm hover:text-gray-700 py-1 pl-2 pr-6",
        "focus:ring-gray-800 focus:border-gray-800",
        className
      )}
      onChange={onChange}
      value={value}
      title={title}
    >
      {children}
    </select>
  );
};
