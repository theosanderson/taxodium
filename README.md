# Taxonium

Taxonium is a tool for exploring trees.

<p align="center"><a href="https://taxonium.org"><img src="https://user-images.githubusercontent.com/19732295/169698808-48204d73-c468-4e80-aff5-876e5df7eab4.png" width=250 /></a></p>

### [➡️ Launch Taxonium](https://taxonium.org)

### [📚 Read the documentation](https://taxonium.readthedocs.io/en/latest/)

## How do I..

### visualise my own Newick phylogeny?

Upload a Newick file to [Taxonium.org](http://taxonium.org), and optionally a metadata file in CSV or TSV format. If using a metadata file the leftmost column must contain names of the nodes as in the tree.

### explore the global SARS-CoV-2 phylogeny?

Visit [Cov2Tree.org](http://Cov2Tree.org) which uses Taxonium to allow you to explore a tree built by researchers at UCSC using public data contributed by researchers across the world to the INSDC databases.

### build my own mutation-annotated tree to explore in Taxonium, or add my own metadata to an existing phylogeny?

Use [UShER](https://github.com/yatisht/usher/) to build a mutation-annotated tree. Then use [taxoniumtools](./taxoniumtools/) to convert it to a Taxonium format you can upload to the interface at [Taxonium.org](Taxonium.org)

You can also use taxoniumtools to add your own metadata to the existing public phylogeny.

Find out more in [📚 the documentation](https://taxonium.readthedocs.io/en/latest/).

## Structure

Taxonium now consists of a number of components:

- [taxoniumtools](./taxoniumtools/) - a Python package that lets you easily generate Taxonium files from Usher protobuf files
- [taxonium_web_client](./taxonium_web_client/) - the web client that is available at e.g. taxonium.org and let's you explore Taxonium files in your browser
- [taxonium_backend](./taxonium_backend/) - a server-based backend that allows Taxonium trees to be explored without the user downloading the full tree (N.B. Taxonium can also be used without this backend, with static files acccessed in taxonium_web_client)
- [taxonium_data_handling](./taxonium_data_handling/) - this is a node package upon which both the web client and the backend depend (it handles core logic common to both)

## See Taxonium in action

- [Cov2Tree](https://cov2tree.org/)
- [Exploring the NCBI Taxonomy](https://taxonium.org/?treeUrl=https%3A%2F%2Fcov2tree.nyc3.digitaloceanspaces.com%2Fncbi%2Ftree.nwk.gz&ladderizeTree=true&metaUrl=https%3A%2F%2Fcov2tree.nyc3.digitaloceanspaces.com%2Fncbi%2Fmetadata.tsv.gz&configUrl=https%3A%2F%2Fcov2tree.nyc3.digitaloceanspaces.com%2Fncbi%2Fconfig.json)
- [Serratus](https://serratus.io/trees) (click Tree Viewer on any tree)
- [mpxTree](http://mpxtree.taxonium.org/)
