import { useState, useEffect } from "react";

const useConfig = (backend, view, overlayRef) => {
  const [config, setConfig] = useState({
    title: "loading",
    source: "",
    num_nodes: 0,
  });

  useEffect(() => {
    backend.getConfig((results) => {
      const viewState = {
        ...view.viewState,
        target: [2000, results.initial_y],
        zoom: results.initial_zoom,
      };

      const oldViewState = { ...viewState };

      setConfig(results);
      console.log(results);
      view.onViewStateChange({
        viewState,
        oldViewState,
        interactionState: "isZooming",
      });

      overlayRef.current.innerHTML = results.overlay;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend]);

  return config;
};

export default useConfig;
