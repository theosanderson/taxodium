import useServerBackend from "./useServerBackend";
import useLocalBackend from "./useLocalBackend";

function useBackend(backend_url, sid, url_on_fail, uploaded_data, proto) {
  const serverBackend = useServerBackend(backend_url, sid, url_on_fail);
  const localBackend = useLocalBackend(uploaded_data, proto);
  if (backend_url) {
    return serverBackend;
  }
  if (uploaded_data) {
    return localBackend;
  } else {
    return null;
  }
}
export default useBackend;
