const PROXY_URL = "http://proxy.taxonium.org/?url=";

export const downloadWithProxy = async (url, options = {}) => {
  const { onDownloadProgress, responseType = "arraybuffer" } = options;

  try {
    const response = await axios.get(url, {
      responseType,
      onDownloadProgress,
    });
    return response;
  } catch (error) {
    // Ask user if they want to try proxy
    const useProxy = window.confirm(
      "Download failed. This might be due to CORS restrictions. Would you like to try downloading through a proxy?"
    );

    if (useProxy) {
      const proxyUrl = PROXY_URL + encodeURIComponent(url);
      const response = await axios.get(proxyUrl, {
        responseType,
        onDownloadProgress,
      });
      return response;
    }

    throw error; // Re-throw if user declines proxy
  }
};
