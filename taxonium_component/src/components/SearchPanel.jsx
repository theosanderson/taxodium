import SearchTopLayerItem from "./SearchTopLayerItem";
import { RiAddCircleLine, RiArrowLeftUpLine } from "react-icons/ri";
import { BiPalette } from "react-icons/bi";
import { Button } from "../components/Basic";
import { BsBoxArrowInUpRight, BsQuestionCircle } from "react-icons/bs";
import { MdArrowForward, MdArrowDownward } from "react-icons/md";
import ReactTooltip from "react-tooltip";
import prettifyName from "../utils/prettifyName";

import { FaSearch, FaShare } from "react-icons/fa";

import { Select } from "./Basic";
import ListOutputModal from "./ListOutputModal";

import { useState, useMemo, useEffect } from "react";

import classNames from "classnames";

import SearchDisplayToggle from "./SearchDisplayToggle";

import SNPOutputModal from "./snpModal";

const prettify_x_types = { x_dist: "Distance", x_time: "Time" };

const formatNumber = (num) => {
  return num !== null && typeof num === "number" ? num.toLocaleString() : "";
};

const formatNumberIfNumber = (possNum) => {
  return typeof possNum === "number" ? possNum.toLocaleString() : possNum;
};
const fixName = (name) => {
  return name;
  //return typeof name == "string"
  //  ? name.replace("hCoV-19/", "hCoV-19/\n")
  //  : name;
};

const fixAuthors = (authors) => {
  // make sure comma is always followed by space
  return authors.replace(/,([^\s])/g, ", $1");
};

function SearchPanel({
  search,
  colorBy,
  config,
  selectedDetails,
  overlayContent,
  setAboutEnabled,
  colorHook,
  xType,
  setxType,
  settings,
  backend,
  className,
  treenomeState,
  view,
  perNodeFunctions,
  toggleSidebar,
}) {
  useEffect(() => {
    ReactTooltip.rebuild();
  });

  const covSpectrumQuery = useMemo(() => {
    if (selectedDetails.nodeDetails && selectedDetails.nodeDetails.node_id) {
      return perNodeFunctions.getCovSpectrumQuery(
        selectedDetails.nodeDetails.node_id
      );
    } else {
      return null;
    }
  }, [selectedDetails.nodeDetails]);

  const [listOutputModalOpen, setListOutputModalOpen] = useState(false);
  const [snpSearchModalOpen, setSnpSearchModalOpen] = useState(false);
  const [showSNPButton, setShowSNPButton] = useState(false);
  useEffect(() => {
    // Check if the current URL includes "api.cov2tree.org"
    if (window.location.href.includes("api.cov2tree.org")) {
      setShowSNPButton(true);
    }
  }, []);

  const handleDownloadJson = () => {
    if (selectedDetails.nodeDetails) {
      const node_id = selectedDetails.nodeDetails.node_id;
      backend.getNextstrainJson(node_id, config);
    }
  };

  const formatMetadataItem = (key) => {
    // if matches a markdown link "[abc](https://abc.com)" then..
    if (key === "num_tips" && selectedDetails.nodeDetails[key] === 1) return;

    if (
      selectedDetails.nodeDetails &&
      selectedDetails.nodeDetails[key] &&
      selectedDetails.nodeDetails[key].match &&
      selectedDetails.nodeDetails[key].match(/\[.*\]\(.*\)/)
    ) {
      const [, text, url] =
        selectedDetails.nodeDetails[key].match(/\[(.*)\]\((.*)\)/);
      return (
        <div className="text-sm mt-1" key={key}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-800 underline"
          >
            {text} <BsBoxArrowInUpRight className="inline-block ml-1" />
          </a>
        </div>
      );
    }

    if (config.metadataTypes && config.metadataTypes[key] === "sequence") {
      return (
        <div className="text-sm mt-1" key={key}>
          <span className="font-semibold">{prettifyName(key, config)}:</span>{" "}
          <div className="text-xs font-mono break-all">
            {selectedDetails.nodeDetails[key]}
          </div>
        </div>
      );
    }

    return (
      <div className="text-sm mt-1" key={key}>
        <span className="font-semibold">{prettifyName(key, config)}:</span>{" "}
        {colorBy.colorByField === key ? (
          <span
            style={{
              color: colorHook.toRGBCSS(selectedDetails.nodeDetails[key]),
            }}
          >
            {selectedDetails.nodeDetails[key]}
          </span>
        ) : (
          formatNumberIfNumber(selectedDetails.nodeDetails[key])
        )}
        {key === "num_tips" && (
          <span className="ml-1">
            <a
              data-for="menu_descendants"
              data-tip="8"
              className="cursor-pointer"
            >
              {" "}
              <FaShare className="inline-block" />
            </a>
            <ReactTooltip
              id="menu_descendants"
              getContent={(dataTip) => (
                <div>
                  <h2>For this clade:</h2>
                  <div className="mb-3">
                    <Button
                      className=""
                      onClick={() => {
                        if (
                          selectedDetails.nodeDetails.num_tips > 100000 &&
                          !window.warning_shown
                        ) {
                          // pop up a warning and ask if we want to continue
                          alert(
                            "WARNING: This node has a large number of descendants. Displaying them all may take a while or crash this browser window. Are you sure you want to continue? If so press the button again."
                          );
                          window.warning_shown = true;
                          return;
                        }
                        setListOutputModalOpen(true);
                      }}
                    >
                      List all tips
                    </Button>
                  </div>

                  {config.enable_ns_download &&
                    selectedDetails.nodeDetails[key] < 1000000 &&
                    !config.from_newick && (
                      <>
                        <div className="mb-3">
                          <Button className="" onClick={handleDownloadJson}>
                            Download Nextstrain JSON
                          </Button>
                        </div>

                        {backend.type === "server" &&
                          !backend.backend_url.includes("localhost") &&
                          selectedDetails.nodeDetails[key] < 20000 && (
                            <>
                              <div className="mb-3">
                                <Button
                                  className=""
                                  href={
                                    "https://nextstrain.org/fetch/" +
                                    backend
                                      .getNextstrainJsonUrl(
                                        selectedDetails.nodeDetails.node_id,
                                        config
                                      )
                                      .replace("https://", "")
                                      .replace("http://", "")
                                  }
                                  target="_blank"
                                >
                                  View clade in Nextstrain
                                </Button>
                              </div>
                            </>
                          )}
                      </>
                    )}

                  {config.covspectrum_links && (
                    <div className="mb-3">
                      <Button
                        href={covSpectrumQuery}
                        className=""
                        target="_blank"
                      >
                        Find in CovSpectrum
                      </Button>
                    </div>
                  )}
                </div>
              )}
              effect="solid"
              delayHide={500}
              delayShow={0}
              delayUpdate={500}
              place={"right"}
              border={true}
              type={"light"}
            />
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className={classNames("flex flex-col px-4 divide-y text-sm", className)}
    >
      <button onClick={toggleSidebar}>
        <br />
        {window.innerWidth > 768 ? (
          <MdArrowForward className="mx-auto w-5 h-5 sidebar-toggle" />
        ) : (
          <MdArrowDownward className="mx-auto w-5 h-5 sidebar-toggle" />
        )}
      </button>
      <div className="space-y-2 py-3">
        {config.num_tips && (
          <>
            <p className="text-gray-500 text-sm">
              {overlayContent ? (
                <>
                  <span title={config.date_created ? config.date_created : ""}>
                    Displaying
                  </span>{" "}
                  <button
                    className="underline"
                    onClick={() => {
                      setAboutEnabled(true);
                    }}
                  >
                    {formatNumber(config.num_tips)}{" "}
                    {config.tipPluralNoun ? config.tipPluralNoun : "sequences"}
                  </button>{" "}
                  {config.source && ` from ${config.source}`}
                </>
              ) : (
                <>
                  Displaying {formatNumber(config.num_tips)}{" "}
                  {config.tipPluralNoun ? config.tipPluralNoun : "sequences"}
                  {config.source && ` from ${config.source}`}
                </>
              )}
            </p>
            {config.enabled_by_gisaid && (
              <span className="text-gray-500 mt-1">
                Enabled by data from{" "}
                <a
                  rel="noopener noreferrer"
                  href="https://www.gisaid.org"
                  target="_blank"
                >
                  <img
                    src="https://www.gisaid.org/fileadmin/gisaid/img/schild.png"
                    alt="gisaid-logo"
                    width="65"
                    className="inline-block"
                  />
                </a>
                .
              </span>
            )}
          </>
        )}
        {config.x_accessors && config.x_accessors.length > 1 && (
          <label className="space-x-2 text-sm block">
            <span className="text-gray-500 text-sm">Tree type:</span>
            <Select
              value={xType}
              onChange={(e) => setxType(e.target.value)}
              className="text-gray-500 text-xs py-0.5"
            >
              {config.x_accessors.map((x) => (
                <option key={x} value={x}>
                  {prettify_x_types[x]}
                </option>
              ))}
            </Select>
          </label>
        )}
        {treenomeState.genome &&
          treenomeState.genome.length > 0 &&
          window.location &&
          !window.location.href.includes("disabletreenome") && (
            <span>
              <span className="text-gray-500 text-sm">Treenome Browser:</span>
              <input
                name="treenomeEnabled"
                style={{ verticalAlign: "middle" }}
                type="checkbox"
                className="m-3 inline-block"
                checked={settings.treenomeEnabled}
                onChange={(event) => {
                  settings.setTreenomeEnabled(!settings.treenomeEnabled);
                }}
              />
              <button
                style={{ cursor: "default" }}
                data-tip="Display a browser with each genome's mutations alongside the tree.&nbsp;<a href='https://docs.taxonium.org/en/latest/treenome.html' class='tooltipLink' target='_blank'>Learn more</a>"
                data-html={true}
              >
                <span
                  style={{ display: "inline-block", verticalAlign: "middle" }}
                >
                  <BsQuestionCircle />
                </span>
              </button>
            </span>
          )}
      </div>
      <div className="py-3 space-y-2">
        <div className="flex space-x-2">
          <h2 className="font-bold text-gray-700 flex items-center whitespace-nowrap">
            <BiPalette className="mr-1.5 text-gray-500 h-5 w-5" />
            {
              // if locale is US return "Color by" otherwise "Colour by" :sob:
              window.navigator.language === "en-US" ? "Color by" : "Colour by"
            }
            :
          </h2>
          <Select
            value={colorBy.colorByField}
            onChange={(e) => colorBy.setColorByField(e.target.value)}
          >
            {colorBy.colorByOptions.map((item) => (
              <option key={item} value={item}>
                {prettifyName(item, config)}
              </option>
            ))}
          </Select>
        </div>
        {colorBy.colorByField === "genotype" && (
          <div className="space-x-2">
            <label className="space-x-2">
              <span>Gene</span>
              <Select
                value={colorBy.colorByGene}
                onChange={(e) => colorBy.setColorByGene(e.target.value)}
                className="w-20"
              >
                {config.genes &&
                  config.genes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
              </Select>
            </label>
            <label className="space-x-2">
              <span>Residue</span>
              <input
                value={colorBy.colorByPosition}
                onChange={(e) =>
                  colorBy.setColorByPosition(
                    e.target.value !== "" ? parseInt(e.target.value) : ""
                  )
                }
                type="number"
                min="0"
                className="inline-block w-16 border py-1 px-1 text-grey-darkest text-sm"
              />
            </label>
          </div>
        )}
      </div>
      <div className="py-3 flex flex-col md:min-h-0">
        <h2 className="font-bold text-gray-700 flex justify-between items-center mb-2">
          <div className="flex items-center">
            <FaSearch className="ml-1 mr-1.5 text-gray-500 h-4 w-4" />
            Search
          </div>
          <SearchDisplayToggle settings={settings} />
        </h2>
        <div className="space-y-2 md:overflow-y-auto -mr-4 pr-4">
          {search.searchSpec.map((item) => (
            <SearchTopLayerItem
              key={item.key}
              singleSearchSpec={item}
              myKey={item.key}
              search={search}
              config={config}
            />
          ))}
          <Button
            className="mx-auto flex items-center font-medium leading-6 mt-2"
            onClick={search.addNewTopLevelSearch}
          >
            <RiAddCircleLine className="mr-1 h-4 w-4 text-gray-500" />
            <span>Add a new search</span>
          </Button>
          {showSNPButton && (
            <Button
              className="mx-auto flex items-center font-medium leading-6 mt-2"
              style={{ transform: "translateY(-10px) translateX(10px)" }}
              onClick={() => setSnpSearchModalOpen(true)}
              title="Search for samples within a given SNP distance of the inputted node"
            >
              SNP Distance Search
            </Button>
          )}
          {showSNPButton && (
            <SNPOutputModal
              snpOutputModalOpen={snpSearchModalOpen}
              setSnpOutputModalOpen={setSnpSearchModalOpen}
            />
          )}
        </div>
      </div>
      {selectedDetails.nodeDetails && (
        <div className="py-3 px-4 md:px-0 mb-0 fixed bottom-0 left-0 right-0 bg-white md:static shadow-2xl md:shadow-none overflow-auto">
          <ListOutputModal
            ariaHideApp={false}
            nodeId={selectedDetails.nodeDetails.node_id}
            backend={backend}
            possibleKeys={["name", ...config.keys_to_display]}
            listOutputModalOpen={listOutputModalOpen}
            setListOutputModalOpen={setListOutputModalOpen}
          />
          <header className="flex items-start justify-between">
            <h2 className="font-bold whitespace-pre-wrap text-sm">
              {selectedDetails.nodeDetails[config.name_accessor] !== "" ? (
                fixName(selectedDetails.nodeDetails[config.name_accessor])
              ) : (
                <i>
                  Internal node{" "}
                  <small>{selectedDetails.nodeDetails.node_id}</small>
                </i>
              )}
              {selectedDetails.nodeDetails.parent_id !==
                selectedDetails.nodeDetails.node_id && (
                <button
                  className="inline-block text-sm text-gray-700 hover:text-black ml-2"
                  title="Select parent"
                  onClick={() => {
                    selectedDetails.getNodeDetails(
                      selectedDetails.nodeDetails.parent_id
                    );
                  }}
                >
                  <RiArrowLeftUpLine className="inline-block mr-2" />
                </button>
              )}
            </h2>

            <button
              onClick={() => selectedDetails.clearNodeDetails()}
              className="text-gray-500"
            >
              close
            </button>
          </header>
          {selectedDetails.nodeDetails["meta_ThumbnailURL"] && (
            <img
              src={selectedDetails.nodeDetails["meta_ThumbnailURL"]}
              alt="thumbnail"
            />
          )}

          {colorBy.colorByField === "genotype" && (
            <span
              style={{
                color: colorHook.toRGBCSS(
                  colorBy.getNodeColorField(selectedDetails.nodeDetails)
                ),
              }}
            >
              {colorBy.colorByGene}:{colorBy.colorByPosition}
              {colorBy.getNodeColorField(selectedDetails.nodeDetails)}
            </span>
          )}
          {[...config.keys_to_display, "num_tips"].map(
            (key) =>
              selectedDetails.nodeDetails[key] &&
              formatMetadataItem(key, selectedDetails)
          )}
          {((config.mutations && config.mutations.length) ||
            config.useHydratedMutations) > 0 &&
            selectedDetails.nodeDetails.node_id !==
              selectedDetails.nodeDetails.parent_id && (
              <>
                <div className="text-xs font-bold mt-2 mb-0 text-gray-700 justify-between flex">
                  <div className="pt-1">Mutations at this node:</div>{" "}
                  {settings.miniMutationsMenu()}
                </div>
                <div className="text-xs leading-5 mt-1 text-gray-700">
                  {settings
                    .filterMutations(selectedDetails.nodeDetails.mutations)
                    .sort((a, b) => {
                      if (a.gene !== b.gene) {
                        return a.gene > b.gene ? 1 : -1;
                      }
                      return parseInt(a.residue_pos) > parseInt(b.residue_pos)
                        ? 1
                        : -1;
                    })
                    .map((mutation, i) => (
                      <span key={mutation.mutation_id}>
                        {i > 0 && <>, </>}
                        <div className="inline-block">
                          {mutation.gene}:{mutation.previous_residue}
                          {mutation.residue_pos}
                          {mutation.new_residue}
                        </div>
                      </span>
                    ))}
                  {selectedDetails.nodeDetails.mutations.length === 0 && (
                    <div className=" italic">
                      No{" "}
                      {settings.filterMutations([{ type: "nt" }]).length ===
                      0 ? (
                        <>coding</>
                      ) : (
                        <></>
                      )}{" "}
                      mutations
                    </div>
                  )}
                </div>
              </>
            )}

          <div>
            {selectedDetails.nodeDetails.acknowledgements && (
              <div className="text-xs mt-3  text-gray-700 mr-3">
                <div className="mt-1 justify">
                  <b className="font-semibold">Authors:</b>{" "}
                  {selectedDetails.nodeDetails.acknowledgements.authors}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPanel;
