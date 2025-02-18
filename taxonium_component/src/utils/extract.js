import processJsonLines from "./nodeMapper.js";

/*
getParsimonySamples function outline:
inputs:
  sampleID, which is the explicit node or sample name, not internal ID
  maxParsimony, which is the SNP distance threshold of interest
  Nested functions:
    processJsonLines: main worker of the backend, which reads in the jsonl file and constructs a map of all internal nodes, children, and mutations, and checks if the sample exists in the tree
    findNodesWithinDistance: a helper function to find all nodes within a certain distance of a given node
      traverses up and down the tree, adding nodes to a results array if they are within the distance threshold
      returns the results array
      traverseUp: helper function to traverse up the tree, adding nodes to the results array if they are within the distance threshold
      traverseDown: helper function to traverse down the tree, adding nodes to the results array if they are within the distance threshold
outputs: should output a simple list/array-like of internal IDs and their SNP distances from the queried node, some flags that determine whether or not a valid search was performed, as well as a map of each nodes name with genbank accession and pangolin lineage
with this list as a result, we can then query the backend for more information about each node, like name, mutations, etc, if needed
  this above includes if specificMut is passed through, which would allow for filtering based on whether or not a node has a specific mutation,
  but the filtering is done after all SNPs within distance are found, to reduce processing time if flag isnt specified
once the list is obtained, snpComponent formats the list for output into Taxonium(Big step)
*/
async function getParsimonySamples(sampleID, maxParsimony) {
  return processJsonLines(
    "https://cov2tree.nyc3.cdn.digitaloceanspaces.com/latest_public.jsonl.gz",
    sampleID
  )
    .then((myResult) => {
      //answersArray=[nodes, foundSample, foundSampleID, foundParentID, foundSNPCount, isBranch]
      if (myResult === "Error parsing JSON") {
        //if error parsing JSON, return error
        return "Error parsing JSON";
      }
      var nodeMap = myResult[0]; //index of all internal nodes and children
      // Main function to find all nodes within a certain distance of a given node
      function findNodesWithinDistance(node, distanceThreshold) {
        // Helper function to traverse up (towards the parent)
        function traverseUp(node, currentDistance) {
          var parent_id = nodeMap[node].parent_id;
          var snpCount = nodeMap[node].snpCount;
          if (parent_id === node || currentDistance > distanceThreshold) {
            //if root node(root has itself as parent), or if threshold is reached,
            //console.log("reached root node or threshold, returning at distance "+currentDistance+" from node "+node+" with parent "+parent_id+" and snpCount "+snpCount)
            return; //end traversal
          }
          //console.log("traversing up, new node is "+parent_id+" with distance "+(currentDistance + snpCount))
          if (!visited.has(parent_id)) {
            // Check if this node has already been visited to avoid infinite loops
            visited.add(parent_id);
            traverseDown(parent_id, currentDistance + snpCount); //Traverse down from the parent
            traverseUp(parent_id, currentDistance + snpCount); // Traverse further up
          }
        }
        // Helper function to traverse down (towards the children)
        function traverseDown(node, currentDistance) {
          if (!nodeMap[node] || currentDistance > distanceThreshold) {
            return;
          } //if node is a leaf node, or it threshold is reached, return
          for (const child of nodeMap[node].children) {
            // Traverse all children
            let decodedChild = child.split("="); //split encoded child into internal ID and SNP distance
            let childId = decodedChild[0]; //get internal ID of child
            let childSnpDist = parseInt(decodedChild[1]); //get SNP distance of child
            let newTotal = currentDistance + childSnpDist; //add SNP distance of child to current distance
            //console.log("traversing down, new node is "+childId+" with distance "+childSnpDist+" for new total "+newTotal)
            if (!visited.has(childId) && !visited.has(decodedChild[3])) {
              //need a switch to add childs as genbank accession or node ID, since some sample names are repeated
              if (childId.match(/^\d+$/)) {
                //if its just numbers, its an internal node, so we add it to visited as is
                visited.add(childId);
              } else {
                visited.add(decodedChild[3]);
              } //if its not just numbers, its a leaf node, so we add the genbank accession to visited
              if (newTotal <= distanceThreshold) {
                //dont add the root node, as its always going to be within SNP distance of itself
                //console.log("adding node to results:"+childId+" with distance "+newTotal)
                if (!nodeMap[childId]) {
                  //if its not an entry in node map, means its not an internal node, so we add it to the results
                  //console.log("adding node to results:"+decodedChild)
                  results.push([
                    decodedChild[0],
                    newTotal,
                    decodedChild[2],
                    decodedChild[3],
                  ]);
                }
              }
              if (nodeMap[childId]) {
                //if the child is an internal node, traverse down
                traverseDown(childId, newTotal); // Traverse further down; pass ID, not node info itself
              }
            }
          }
        }

        // Start of the main function
        //boolean obtained during traversal of the whole tree; if the queried sample exists in taxonium, this will flag as true
        if (!myResult[1]) {
          //if boolean is falsey
          console.log("Node not found in the tree"); //its not a valid node, return error statement
          return "Node not found in the tree";
        }

        let visited = new Set(); // To keep track of visited nodes
        let results = []; // To store nodes within the distance threshold
        visited.add(myResult[2]); //add ID of queried sample to visited
        if (myResult[5]) {
          //if the node is an internal node
          traverseDown(myResult[2], 0); //start traversal from the internal node, we have a neutral distance of 0
          traverseUp(myResult[2], 0);
        } else {
          traverseDown(myResult[3], myResult[4]);
          traverseUp(myResult[3], myResult[4]);
        }
        //internal ID of the queried sample
        // Traverse as far down as possible first, then go up, and traverse down again ignoring visited nodes
        return results;
      }

      let goodSamples = findNodesWithinDistance(sampleID, maxParsimony);
      nodeMap = null;
      return goodSamples;
    })
    .catch((error) => {
      // Catch any errors from processJsonLines or thrown in the then block
      console.error("Error in getParsimonySamples:", error);
      return "Error processing samples";
    });
}
/*
getParsimonySamples("node_960478", 5)
    .then(result => {
        console.log("Results:", result);
    })
    .catch(error => {
        console.error("Error processing samples:", error);
    });
*/
export default getParsimonySamples;

/*
NOTES:
*/
