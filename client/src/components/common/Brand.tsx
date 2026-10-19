import SouthEastRounded from "@mui/icons-material/SouthEastRounded";
import { Link } from "react-router-dom";

export default function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Bindirim ana sayfa">
      <span className="brand__symbol">
        <SouthEastRounded />
      </span>
      <span>
        bindirim<span className="brand__dot">.</span>
      </span>
    </Link>
  );
}
