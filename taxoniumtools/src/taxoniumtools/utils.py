from alive_progress import alive_it, alive_bar
import pandas as pd
import warnings
import os, tempfile, sys
import treeswift
from . import ushertools


def nan_to_empty_string(x):
    if pd.isna(x):
        return ""
    else:
        return x


def read_metadata(metadata_file, columns):
    must_have_cols = ['strain']
    cols_of_interest = set(columns.split(",")) if columns else set()
    cols_of_interest.update(must_have_cols)
    cols_of_interest = list(cols_of_interest)

    #only load these cols:
    if metadata_file:
        print("Loading metadata file..")
        #Disable warnings because of DTypeWarning in pandas

        warnings.filterwarnings("ignore")
        metadata = pd.read_csv(metadata_file,
                               sep="\t" if metadata_file.endswith(".tsv")
                               or metadata_file.endswith(".tsv.gz") else ",",
                               usecols=cols_of_interest)
        # Enable again
        warnings.filterwarnings("default")
        metadata.set_index("strain", inplace=True)
        # convert metadata to dict of rows

        metadata_dict = metadata.to_dict("index")
        metadata_cols = metadata.columns
        metadata_vocabs = {}
        for col in metadata_cols:
            # If the number of unique values is less than 10% of the total number of rows, then make a vocab with the unique values as a list
            if len(metadata[col].unique()) < 0.1 * metadata.shape[0]:
                initial_list = metadata[col].unique().tolist()
                as_strings = [
                    str(nan_to_empty_string(x)) for x in initial_list
                ] + ['']
                as_sorted_set = sorted(set(as_strings))
                metadata_vocabs[col] = as_sorted_set

        del metadata
        print("Metadata loaded")
        vocab_lookups = {}
        for col in metadata_vocabs:
            vocab_lookups[col] = {
                x: i
                for i, x in enumerate(metadata_vocabs[col])
            }
        #raise ValueError(vocab_lookups)
        return metadata_dict, metadata_cols, metadata_vocabs, vocab_lookups
    else:
        metadata_dict = {}
        metadata_cols = []
        metadata_vocabs = {}
        vocab_lookups = {}
        return metadata_dict, metadata_cols, metadata_vocabs, vocab_lookups


def do_chronumental(mat, chronumental_reference_node, metadata_file,
                    chronumental_steps, chronumental_date_output):
    chronumental_is_available = os.system(
        "which chronumental > /dev/null") == 0
    if not chronumental_is_available:
        print("#####  Chronumental is not available.  #####")
        print(
            "#####  Please install it with `pip install chronumental` and restart. Or you can disable the --chronumental flag.  #####"
        )
        print("#####  Exiting.  #####")
        sys.exit(1)
    with tempfile.TemporaryDirectory() as tmpdirname:
        mat.tree.write_tree_newick(
            os.path.join(tmpdirname, "distance_tree.nwk"))

        print("Launching chronumental")

        command = f"chronumental --tree {os.path.join(tmpdirname, 'distance_tree.nwk')} --dates {metadata_file} --steps {chronumental_steps} --tree_out {os.path.join(tmpdirname, 'timetree.nwk')}"
        if chronumental_reference_node:
            command += f" --reference_node '{chronumental_reference_node}'"

        if chronumental_date_output:
            command += f" --dates_out {chronumental_date_output}"
        result = os.system(command)
        if result != 0:
            print("#####  Chronumental failed.  #####")
            print("#####  Exiting.  #####")
            sys.exit(1)

        # %%

        print("Reading time tree")
        time_tree = treeswift.read_tree(os.path.join(tmpdirname,
                                                     "timetree.nwk"),
                                        schema="newick")
        time_tree_iter = ushertools.preorder_traversal(time_tree.root)
        for i, node in alive_it(enumerate(
                ushertools.preorder_traversal(mat.tree.root)),
                                title="Adding time tree"):
            time_tree_node = next(time_tree_iter)

            node.time_length = time_tree_node.edge_length
        del time_tree
        del time_tree_iter


def set_x_coords(root, chronumental_enabled):
    """ Set x coordinates for the tree"""
    root.x_dist = 0
    root.x_time = 0
    for node in alive_it(root.traverse_preorder(),
                         title="Setting x coordinates"):
        if node.parent:
            node.x_dist = node.parent.x_dist + node.edge_length
            if chronumental_enabled:
                node.x_time = node.parent.x_time + node.time_length


def set_terminal_y_coords(root):
    for i, node in alive_it(enumerate(root.traverse_leaves()),
                            title="Setting terminal y coordinates"):
        node.y = i
        node.y = i


def set_internal_y_coords(root):
    # Each node should be halfway between the min and max y of its children
    for node in alive_it(root.traverse_postorder(leaves=False, internal=True),
                         title="Setting internal y coordinates"):

        child_ys = [child.y for child in node.children]
        node.y = (min(child_ys) + max(child_ys)) / 2


def get_all_aa_muts(root):
    all_aa_muts = set()
    for node in alive_it(list(root.traverse_preorder()),
                         title="Collecting all AA mutations"):
        if node.aa_muts:
            all_aa_muts.update(node.aa_muts)
    return list(all_aa_muts)


def get_all_nuc_muts(root):
    all_nuc_muts = set()
    for node in alive_it(list(root.traverse_preorder()),
                         title="Collecting all nuc mutations"):
        if node.nuc_mutations:
            all_nuc_muts.update(node.nuc_mutations)
    return list(all_nuc_muts)


def make_aa_object(i, aa_tuple):
    # Tuple format is gene, position, prev, next
    gene, pos, prev, next = aa_tuple
    return {
        "gene": gene,
        "previous_residue": prev,
        "residue_pos": pos,
        "new_residue": next,
        "mutation_id": i,
        "type": "aa"
    }


def make_nuc_object(i, nuc_mut):
    return {
        "gene": "nt",
        "previous_residue": nuc_mut.par_nuc,
        "residue_pos": nuc_mut.one_indexed_position,
        "new_residue": nuc_mut.mut_nuc,
        "mutation_id": i,
        "type": "nt"
    }


def get_node_object(node, node_to_index, metadata, input_to_index, columns,
                    chronumental_enabled, vocab_lookups):

    object = {}
    object["name"] = node.label if node.label else ""
    # round to 5 dp
    object["x_dist"] = round(node.x_dist, 5)
    if chronumental_enabled:
        object["x_time"] = round(node.x_time, 5)
    object["y"] = node.y
    object['mutations'] = [
        input_to_index[my_input] for my_input in node.aa_muts
    ] + [input_to_index[my_input] for my_input in node.nuc_mutations]
    # check if label is in metadata's index
    try:
        my_dict = metadata[node.label]
        for key in my_dict:
            value = my_dict[key]
            #if value is pd.NaN then set to empty string
            if pd.isna(value):
                value = ""
            object["meta_" + key] = value
    except KeyError:
        for key in columns:
            object["meta_" + key] = ""

    for key in columns:
        if key in vocab_lookups:
            object["meta_" + key] = vocab_lookups[key][object["meta_" + key]]

    object['parent_id'] = node_to_index[
        node.parent] if node.parent else node_to_index[node]
    object['node_id'] = node_to_index[
        node]  # We don't strictly need this, but it doesn't add much to the space

    object['num_tips'] = node.num_tips
    return object


def sort_on_y(mat):
    with alive_bar(title="Sorting on y") as bar:

        def return_y(node):
            bar()
            return node.y

        nodes_sorted_by_y = sorted(mat.tree.root.traverse_preorder(),
                                   key=lambda x: return_y(x))
    return nodes_sorted_by_y
