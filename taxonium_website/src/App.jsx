import React, { useState, Suspense, useRef, useEffect } from "react";
import AboutOverlay from "./components/AboutOverlay";
import TaxoniumBit from "./components/TaxoniumBit";
import { CgListTree } from "react-icons/cg";
import { BsInfoSquare } from "react-icons/bs";
import { FaGithub } from "react-icons/fa";
import { HiOutlineBookOpen } from "react-icons/hi";
import useQueryAsState from "./hooks/useQueryAsState";
import classNames from "classnames";
import { useInputHelper } from "./hooks/useInputHelper";
import InputSupplier from "./components/InputSupplier";
import treeConfig from "./trees.json";
import { Select } from "./components/Basic";

// Hardcoded list of paths to show in the showcase
const SHOWCASE_PATHS = [
  "sars-cov-2/public",
  "taxonomy/visual",
  "taxonomy/full",
  "mpox/public",
  "flu/H5N1-Outbreak",
];

function checkLegacyHostname() {
  const currentHostname = window.location.hostname;

  // Look through all configurations for matching legacy hostnames
  for (const [path, config] of Object.entries(treeConfig)) {
    if (
      config.legacyHostnames &&
      config.legacyHostnames.includes(currentHostname)
    ) {
      // If we find a match, redirect to the new path
      // Preserve any query parameters
      const newPath = `//taxonium.org/${path}${window.location.search}`;

      // Only redirect if we're not already on the correct path
      if (!window.location.pathname.startsWith(`/${path}`)) {
        window.location.href = newPath;
        return true;
      }
    }
  }

  return false;
}

function getConfigFromPath() {
  // First check for legacy hostname redirects
  if (checkLegacyHostname()) {
    return null; // Return null as we're about to redirect
  }

  // Remove leading slash and get full path
  const path = window.location.pathname.substring(1);
  const decodedPath = decodeURIComponent(path);

  // Return the configuration for this path, if it exists
  return treeConfig[decodedPath] || null;
}

function App() {
  useEffect(() => {
    import("taxonium-component");
  }, []);

  const pathConfig = getConfigFromPath();
  const default_query = pathConfig || {};

  const [uploadedData, setUploadedData] = useState(null);
  const [query, updateQuery] = useQueryAsState(default_query);
  const [title, setTitle] = useState(null);
  const [beingDragged, setBeingDragged] = useState(false);
  const [aboutEnabled, setAboutEnabled] = useState(false);
  const [overlayContent, setOverlayContent] = useState(null);
  const [selectedTree, setSelectedTree] = useState("");

  const dragTimeout = useRef(null);

  const inputHelper = useInputHelper({
    setUploadedData,
    updateQuery,
    query,
    uploadedData,
  });

  function onDrop(ev) {
    console.log("File(s) dropped");
    setBeingDragged(false);
    ev.preventDefault();

    if (ev.dataTransfer.items) {
      for (var i = 0; i < ev.dataTransfer.items.length; i++) {
        if (ev.dataTransfer.items[i].kind === "file") {
          var file = ev.dataTransfer.items[i].getAsFile();
          inputHelper.readFile(file);
        }
      }
    } else {
      inputHelper.readFile(ev.dataTransfer.files[0]);
    }
  }

  function onDragOver(ev) {
    if (
      uploadedData &&
      (uploadedData.status === "loaded" || uploadedData.status === "loading")
    ) {
      ev.preventDefault();
      return;
    }
    setBeingDragged(true);
    if (dragTimeout.current) {
      clearTimeout(dragTimeout.current);
    }
    ev.preventDefault();
  }

  function onDragLeave(ev) {
    if (dragTimeout.current) {
      clearTimeout(dragTimeout.current);
    }
    dragTimeout.current = setTimeout(() => {
      setBeingDragged(false);
    }, 500);
  }

  // Generate showcase items from hardcoded list
  const showCase = SHOWCASE_PATHS.map((path) => {
    const config = treeConfig[path];
    if (!config) {
      console.warn(`No configuration found for showcase path: ${path}`);
      return null;
    }
    return {
      title: config.title,
      url: `/${path}`,
      desc: config.description,
    };
  }).filter(Boolean); // Remove any null entries from missing configs

  useEffect(() => {
    if (selectedTree) {
      const newPath = `/${selectedTree}${window.location.search}`;
      window.location.href = newPath; // Trigger a page refresh on selection change
    }
  }, [selectedTree]);

  return (
    <>
      <AboutOverlay
        enabled={aboutEnabled}
        setEnabled={setAboutEnabled}
        overlayContent={overlayContent}
      />

      <div
        className="h-screen w-screen flex flex-col overflow-hidden"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        {beingDragged && (
          <div className="bg-sky-200 p-5 font-bold">Drop file to import</div>
        )}
        <div
          className={classNames(
            "from-gray-500 to-gray-600 bg-gradient-to-bl shadow-md",
            "flex justify-between items-center px-4 flex-shrink-0",
            "h-16"
          )}
        >
          <h1 className="text-xl text-white flex items-center space-x-2">
            {title ? (
              <>
                {window.screen.width < 600 && (
                  <>
                    <span className="font-medium pr-2 text-lg">{title}</span>
                    <span className="flex flex-col text-center">
                      <span className="text-xs">visualised with</span>
                      <a
                        href="/"
                        className="underline hover:no-underline text-sm flex items-center"
                        target="_top"
                      >
                        <CgListTree className="h-4 w-4 mr-1 mt-0.5" />
                        <span>Taxonium</span>
                      </a>
                    </span>
                  </>
                )}
                {window.screen.width >= 600 && (
                  <>
                    <span
                      className={`font-medium ${
                        title.length > 12 ? "text-lg" : ""
                      }`}
                    >
                      {title}
                    </span>
                    <div className="flex flex-row mt-4">
                      <CgListTree className="h- ml-1 w-4 mr-1" />
                      <span className="text-xs ml-1">visualised with </span>
                      <a
                        href="/"
                        className="underline hover:no-underline text-xs ml-0.5"
                        target="_top"
                      >
                        <span>Taxonium</span>
                      </a>
                    </div>
                  </>
                )}
              </>
            ) : (
              <a href="/" className="hover:underline" target="_top">
                <CgListTree className="h-6 w-6 inline-block mr-2 -mt-1" />
                <span className="font-bold">Taxonium</span>
              </a>
            )}
          </h1>
          <div className="flex items-center">
            {window.screen.width >= 600 &&
              (!new URL(window.location.href).pathname.substring(1) ||
                treeConfig
                  .map((x) => x[0])
                  .contains(
                    new URL(window.location.href).pathname.substring(1)
                  )) && ( // Hide the menu on mobile
                <Select
                  value={new URL(window.location.href).pathname.substring(1)}
                  onChange={(e) => setSelectedTree(e.target.value)}
                  className={"mr-4 !bg-gray-50 ml-4"}
                >
                  <option value="">Select a tree</option>
                  {Object.entries(treeConfig).map(([path, config]) => (
                    <option key={path} value={path}>
                      {path}
                    </option>
                  ))}
                </Select>
              )}
            <button
              onClick={() => setAboutEnabled(true)}
              className="text-white font-bold hover:underline flex items-center"
              title="Info"
            >
              <BsInfoSquare className="w-6 h-6 opacity-80 mr-4" />
            </button>
            <a
              href="https://github.com/theosanderson/taxonium"
              className="text-white font-bold hover:underline flex items-center"
              title="Source code"
              target="_top"
            >
              <FaGithub className="w-6 h-6 opacity-80 mr-2" />
            </a>
          </div>
        </div>
        <Suspense fallback={<div></div>}>
          {query.backend ||
          (uploadedData &&
            (uploadedData.status === "loaded" ||
              uploadedData.status === "url_supplied")) ? (
            <div className="h-[calc(100%-4rem)]">
              <TaxoniumBit
                sourceData={uploadedData}
                query={query}
                updateQuery={updateQuery}
                setOverlayContent={setOverlayContent}
                setTitle={setTitle}
                overlayContent={overlayContent}
                setAboutEnabled={setAboutEnabled}
              />
            </div>
          ) : (
            <div className="m-10 space-y-3">
              <p className="text-lg text-gray-700 mb-5 font-bold">
                Welcome to Taxonium, a tool for exploring large trees
              </p>
              <InputSupplier inputHelper={inputHelper} />
              <div className="flex flex-col space-y-3 pt-6">
                <div className="flex flex-row items-center">
                  <div className="flex-1 border-t border-gray-300"></div>
                  <div className="px-2 text-gray-500 text-sm">
                    or load an existing tree:
                  </div>
                  <div className="flex-1 border-t border-gray-300"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {showCase.map((item, i) => (
                    <div key={i} className="border border-gray-300 rounded p-3">
                      <a
                        href={item.url}
                        className="text-gray-800 hover:underline"
                        target="_top"
                      >
                        {item.title}
                      </a>
                      <p className="text-gray-600 text-sm">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-center pt-5">
                <a
                  href="//docs.taxonium.org"
                  className="text-gray-500 hover:underline"
                  target="_top"
                >
                  <HiOutlineBookOpen className="w-6 h-4 opacity-80 mr-2 inline-block" />
                  Read the Taxonium documentation
                </a>
              </div>
            </div>
          )}
        </Suspense>
      </div>
    </>
  );
}

export default App;
