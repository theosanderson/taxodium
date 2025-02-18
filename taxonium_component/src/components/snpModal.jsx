import Modal from "react-modal";
import { useState } from "react";
import getParsimonySamples from "../utils/extract.js";

/*
Testing Search: node_960478, 5
 -should return 97 results, exluding internal nodes
Germany/IMS-10245-CVDP-57CCA4FC-E286-4E50-AB0F-727CDF76B7BF/2022, 4
should return 0
TODO:
Additional Features to maybe include:
Maybe make each element in the drop down a clickable element to select the node in the SearchPanel
a csv download option for the output
*/
async function getSNPneighbors(nodeId, integerValue, callback) {
  // Dummy backend function
  try {
    let results = await getParsimonySamples(nodeId, integerValue);
    callback(null, results);
  } catch (err) {
    callback(err, null);
  }
}

const SNPOutputModal = ({ snpOutputModalOpen, setSnpOutputModalOpen }) => {
  const [nodeId, setNodeId] = useState("");
  const [integerValue, setIntegerValue] = useState("");
  const [fullOutput, setFullOutput] = useState([]);
  const [displayOutput, setDisplayOutput] = useState([]);
  const [remainingCount, setRemainingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [JsonError, setJsonError] = useState(false);
  const [MissingNoError, setMissingError] = useState(false);
  const [ParsimonyError, setParsimonyError] = useState(false);
  const [emptyReturn, setEmpty] = useState(false);

  const handleSearch = () => {
    if (nodeId && integerValue) {
      setLoading(true);
      setFullOutput([]);
      setDisplayOutput([]);
      setRemainingCount(0);
      setJsonError(false);
      setMissingError(false);
      setParsimonyError(false);
      setEmpty(false);
      const startTime = new Date();
      getSNPneighbors(nodeId, integerValue, (err, res) => {
        if (err) {
          console.log(err);
        } else if (res === "Error parsing JSON") {
          setJsonError(true);
        } else if (res === "Node not found in the tree") {
          setMissingError(true);
        } else if (res === "Error parsing JSON") {
          setParsimonyError(true);
        } else if (res.length === 0) {
          setEmpty(true);
        } else {
          setFullOutput(res);
          setDisplayOutput(res.slice(0, 100));
          setRemainingCount(res.length > 100 ? res.length - 100 : 0);
          const endTime = new Date(); // End timing
          const timeDiff = endTime - startTime; // Time in milliseconds
          console.log(`Time taken: ${timeDiff} ms`);
        }
        setLoading(false);
      });
    }
  };
  const handleCloseModal = () => {
    // Reset all state variables on modal close
    setSnpOutputModalOpen(false);
    setNodeId("");
    setIntegerValue("");
    setFullOutput([]);
    setDisplayOutput([]);
    setRemainingCount(0);
    setLoading(false);
    setJsonError(false);
    setMissingError(false);
    setParsimonyError(false);
    setEmpty(false);
  };
  const convertToTSV = (data) => {
    const header = "Sample Name\tDistance\tPANGO Lineage\tGenbank Accession\n";
    const rows = data
      .map((row) => `${row[0]}\t${row[1]}\t${row[2]}\t${row[3]}`)
      .join("\n");
    return header + rows;
  };
  const downloadTSV = (data) => {
    const tsvString = convertToTSV(data);
    const blob = new Blob([tsvString], { type: "text/tab-separated-values" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${nodeId}_SNP${integerValue}.tsv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };
  return (
    <Modal
      ariaHideApp={false}
      isOpen={snpOutputModalOpen}
      style={{
        content: {
          top: "50%",
          left: "50%",
          right: "auto",
          bottom: "auto",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "80vh",
          backgroundColor: "#fafafa",
          position: "relative",
        },
      }}
      onRequestClose={handleCloseModal}
      contentLabel="Example Modal"
    >
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
        onClick={handleCloseModal}
        style={{
          position: "absolute",
          top: "10px",
          left: "15px",
          zIndex: 1000,
        }}
      >
        Close
      </button>
      <h1 className="font-large mb-3" style={{ textAlign: "center" }}>
        SNP Distance Search
      </h1>
      <div
        className="text-sm"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginLeft: "30px",
          marginRight: "30px",
        }}
      >
        <div style={{ flex: "0 0 55%", marginRight: "10px" }}>
          <label>
            ID:
            <input
              className="block w-full bg-white border border-gray-400 hover:border-gray-500 px-4 py-2 rounded shadow leading-tight focus:outline-none focus:shadow-outline"
              type="text"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              placeholder="Name from Tree"
              style={{ width: "110%" }}
            />
          </label>
        </div>
        <div
          style={{ flex: "0 0 20%", marginRight: "10px", marginLeft: "20px" }}
        >
          <label>
            Distance:
            <input
              className="block w-full bg-white border border-gray-400 hover:border-gray-500 px-4 py-2 rounded shadow leading-tight focus:outline-none focus:shadow-outline"
              type="number"
              value={integerValue}
              onChange={(e) => {
                const value = Math.max(0, parseInt(e.target.value, 10));
                setIntegerValue(value);
              }}
              style={{ width: "100%" }}
            />
          </label>
        </div>
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          onClick={handleSearch}
          style={{
            marginLeft: "-10px",
            height: "42px",
            transform: "translateY(10px)",
          }}
        >
          Search
        </button>
      </div>
      {loading && (
        <div className="text-gray-500" style={{ textAlign: "center" }}>
          Loading data. This may take a minute...
        </div>
      )}
      {!loading && JsonError && (
        <div className="text-gray-500" style={{ textAlign: "center" }}>
          Error parsing JSON.
        </div>
      )}
      {!loading && MissingNoError && (
        <div className="text-gray-500" style={{ textAlign: "center" }}>
          Node not found in the tree.
        </div>
      )}
      {!loading && ParsimonyError && (
        <div className="text-gray-500" style={{ textAlign: "center" }}>
          Error traversing tree.
        </div>
      )}
      {!loading && emptyReturn && (
        <div className="text-gray-500" style={{ textAlign: "center" }}>
          No results found; check your sample ID or change SNP distance.
        </div>
      )}
      {!loading && !emptyReturn && displayOutput.length === 0 && (
        <div className="text-gray-500" style={{ textAlign: "center" }}>
          No data available.
        </div>
      )}
      {!loading && displayOutput.length > 0 && (
        <>
          <div
            style={{
              height: "55vh",
              overflowY: "auto",
              position: "relative",
              borderRight: "1px solid #ddd",
              borderBottom: "1px solid #ddd",
              borderTop: "1px solid #ddd",
              borderLeft: "1px solid #ddd",
              marginTop: "15px",
              maxWidth: 590,
            }}
          >
            <table className="w-full text-sm bg-white rounded shadow leading-tight">
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  backgroundColor: "white",
                  zIndex: 10,
                }}
              >
                <tr>
                  <th
                    className="px-4 py-2 text-left"
                    style={{
                      maxWidth: "250px",
                      wordWrap: "break-word",
                      borderRight: "1px solid #ddd",
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    Sample Name
                  </th>
                  <th
                    className="px-4 py-2 text-center"
                    style={{
                      borderRight: "1px solid #ddd",
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    Distance
                  </th>
                  <th
                    className="px-4 py-2 text-center"
                    style={{
                      borderRight: "1px solid #ddd",
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    PANGO Lineage
                  </th>
                  <th
                    className="px-4 py-2 text-center"
                    style={{ borderBottom: "1px solid #ddd", paddingRight: 0 }}
                  >
                    Genbank Accession
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayOutput.map(
                  ([name, distance, lineage, accession], index) => (
                    <tr key={index}>
                      <td
                        className="border px-4 py-2"
                        style={{
                          maxWidth: "250px",
                          wordWrap: "break-word",
                          borderRight: "1px solid #ddd",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        {name}
                      </td>
                      <td
                        className="border px-4 py-2 text-center"
                        style={{
                          paddingLeft: "25px",
                          borderRight: "1px solid #ddd",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        {distance}
                      </td>
                      <td
                        className="border px-4 py-2 text-center"
                        style={{
                          paddingLeft: "25px",
                          borderRight: "1px solid #ddd",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        {lineage}
                      </td>
                      <td
                        className="border px-4 py-2 text-center"
                        style={{
                          paddingLeft: "25px",
                          borderBottom: "1px solid #ddd",
                          paddingRight: "0px",
                        }}
                      >
                        {accession}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
            {remainingCount > 0 && (
              <div
                style={{ width: "100%", textAlign: "center", padding: "10px" }}
              >
                ...with {remainingCount} more items
              </div>
            )}
          </div>
        </>
      )}
      {!loading && displayOutput.length > 0 && (
        <button
          style={{ marginLeft: "210px", marginRight: "200px" }}
          className="mt-4 bg-blue-600 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded"
          onClick={() => downloadTSV(fullOutput)}
        >
          Download TSV
        </button>
      )}
    </Modal>
  );
};

export default SNPOutputModal;
/*
        <div style={{marginLeft:'-40px', marginRight:'40px' }}>
          <label>
            <input
              type="checkbox"
              checked={internalNodes}
              onChange={() => setInternalNodes(!internalNodes)}
              title= "Checking this will remove include nodes from the search results."
            />
            Filter internal nodes?
          </label>
        </div>
*/
