#!/usr/bin/env python3
"""
Unified Firestore upload entrypoint for FRAUDBUSTER NLP model artifacts.

Supports uploading legitimate, enhanced, or both sets of artifacts with
validation, confirmation prompts, and robust error handling.

Usage examples:
- Upload legitimate: `python3 nlp_module/upload_models.py --model_type legitimate`
- Upload enhanced:   `python3 nlp_module/upload_models.py --model_type enhanced`
- Upload both:       `python3 nlp_module/upload_models.py --model_type both`
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from typing import Optional, Dict


def configure_logging(verbose: bool = True) -> None:
    level = logging.INFO if verbose else logging.WARNING
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )


DEFAULT_CREDENTIALS = (
    "/Users/rjmolina13/Documents/Code_Stuff/FRAUDBUSTER-dev/"
    "fraudbuster-c59d3-firebase-adminsdk-fbsvc-626440b38d.json"
)

FRAUD_DATA_COLLECTION = "fraud_data"


def initialize_firestore(credentials_path: str):
    try:
        if not os.path.exists(credentials_path):
            raise FileNotFoundError(f"Service account file not found: {credentials_path}")
        import firebase_admin
        from firebase_admin import credentials, firestore
        if not firebase_admin._apps:
            cred = credentials.Certificate(credentials_path)
            firebase_admin.initialize_app(cred)
        db = firestore.client()
        logging.info("Firebase initialized")
        return db
    except Exception as e:
        logging.error("Error initializing Firebase: %s", e)
        raise


def read_json_file(file_path: str) -> Optional[Dict]:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logging.error("Error reading JSON file %s: %s", file_path, e)
        return None


def validate_artifacts(base_dir: str, prefix: str) -> Dict[str, str]:
    files = {
        "nlp_model": os.path.join(base_dir, f"{prefix}_nlp_model.json"),
        "vectorizer": os.path.join(base_dir, f"{prefix}_vectorizer.json"),
        "metadata": os.path.join(base_dir, f"{prefix}_model_metadata.json"),
    }
    missing = [k for k, p in files.items() if not os.path.exists(p)]
    if missing:
        raise FileNotFoundError(f"Missing artifact files: {', '.join(missing)} in {base_dir}")
    return files


def confirm_overwrite(db, collection: str, force_yes: bool) -> None:
    from google.cloud.exceptions import NotFound
    docs = ["metadata", "vectorizer", "model_base", "feature_log_prob", "feature_count"]
    try:
        exists_any = False
        for doc in docs:
            snapshot = db.collection(collection).document(doc).get()
            if snapshot.exists:
                exists_any = True
                break
        if exists_any and not force_yes:
            resp = input(
                f"Documents already exist in '{collection}'. Overwrite? [y/N]: "
            ).strip().lower()
            if resp not in ("y", "yes"):
                raise RuntimeError("Upload cancelled by user")
    except NotFound:
        # If collection doesn't exist yet, proceed
        return
    except Exception as e:
        if not force_yes:
            raise


def upload_artifacts(db, collection: str, files: Dict[str, str]) -> None:
    model_data = read_json_file(files["nlp_model"])
    vectorizer_data = read_json_file(files["vectorizer"])
    metadata = read_json_file(files["metadata"]) or {}
    if model_data is None or vectorizer_data is None:
        raise RuntimeError("Failed to read model/vectorizer JSON data")

    model_size = os.path.getsize(files["nlp_model"]) if os.path.exists(files["nlp_model"]) else 0
    vectorizer_size = os.path.getsize(files["vectorizer"]) if os.path.exists(files["vectorizer"]) else 0
    metadata_size = os.path.getsize(files["metadata"]) if os.path.exists(files["metadata"]) else 0

    metadata_doc = {
        "metadata": metadata,
        "format": "json",
        "version": metadata.get("version", "1.0"),
        "upload_timestamp": datetime.now().isoformat(),
        "file_sizes": {
            "model": model_size,
            "vectorizer": vectorizer_size,
            "metadata": metadata_size,
            "total": model_size + vectorizer_size + metadata_size,
        },
    }
    db.collection(collection).document("metadata").set(metadata_doc)

    vectorizer_doc = {
        "vectorizer_data": vectorizer_data,
        "type": "vectorizer",
        "upload_timestamp": datetime.now().isoformat(),
    }
    db.collection(collection).document("vectorizer").set(vectorizer_doc)

    # Split large arrays to separate docs to keep base doc light
    feature_log_prob = model_data.pop("feature_log_prob", [])
    feature_count = model_data.pop("feature_count", [])

    model_doc = {
        "model_data": model_data,
        "type": "model_base",
        "upload_timestamp": datetime.now().isoformat(),
    }
    db.collection(collection).document("model_base").set(model_doc)
    db.collection(collection).document("feature_log_prob").set(
        {
            "feature_log_prob_json": json.dumps(feature_log_prob),
            "type": "feature_log_prob",
            "upload_timestamp": datetime.now().isoformat(),
        }
    )
    db.collection(collection).document("feature_count").set(
        {
            "feature_count_json": json.dumps(feature_count),
            "type": "feature_count",
            "upload_timestamp": datetime.now().isoformat(),
        }
    )
    logging.info("Uploaded artifacts to collection '%s'", collection)


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload FRAUDBUSTER NLP models to Firestore",
    )
    parser.add_argument(
        "--model_type",
        choices=["legitimate", "enhanced", "both"],
        default="both",
        help="Which model artifacts to upload",
    )
    parser.add_argument(
        "--firestore_path",
        type=str,
        default=None,
        help="Firestore collection path. Defaults to type-specific collection.",
    )
    parser.add_argument(
        "--credentials",
        type=str,
        default=DEFAULT_CREDENTIALS,
        help="Path to Firebase service account JSON",
    )
    parser.add_argument(
        "--model_path",
        type=str,
        default=None,
        help="Directory containing model JSON files. Defaults to nlp_module root.",
    )
    parser.add_argument("--yes", action="store_true", help="Skip confirmation prompts")
    parser.add_argument("--quiet", action="store_true", help="Reduce logging verbosity")
    parser.add_argument(
        "--fraud_urls_path",
        type=str,
        default=None,
        help="Path to text file containing fraud URLs, one per line",
    )
    return parser.parse_args(argv)


def resolve_defaults(args: argparse.Namespace) -> argparse.Namespace:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    nlp_dir = os.path.dirname(script_dir)
    if not args.model_path:
        args.model_path = script_dir
    if not args.firestore_path:
        if args.model_type == "legitimate":
            args.firestore_path = "nlp_legit_models"
        elif args.model_type == "enhanced":
            args.firestore_path = "nlp_models"
        else:
            # both: not used directly; we will use per-type defaults
            args.firestore_path = None
    return args


def read_fraud_urls(file_path: str) -> Optional[list]:
    try:
        if not os.path.exists(file_path):
            logging.warning("Fraud URLs file not found: %s", file_path)
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            urls = [line.strip() for line in f if line.strip()]
        logging.info("Loaded %d URLs from %s", len(urls), file_path)
        return urls
    except Exception as e:
        logging.error("Error reading fraud URLs file %s: %s", file_path, e)
        return None


def fetch_existing_fraud_urls(db) -> set:
    logging.info("Fetching existing fraud URLs from Firestore")
    existing_urls = set()
    try:
        doc = db.collection(FRAUD_DATA_COLLECTION).document("fraud_urls").get()
        if doc.exists:
            data = doc.to_dict()
            if isinstance(data.get("urls"), list):
                existing_urls.update(data["urls"])
                logging.info("Found %d URLs in %s/fraud_urls", len(data["urls"]), FRAUD_DATA_COLLECTION)
        for snap in db.collection("fraud_urls").stream():
            d = snap.to_dict()
            url = d.get("url")
            if url:
                existing_urls.add(url)
        logging.info("Total existing unique URLs: %d", len(existing_urls))
    except Exception as e:
        logging.warning("Could not fetch existing URLs: %s", e)
    return existing_urls


def upload_fraud_urls_to_firestore(db, new_urls: list) -> bool:
    logging.info("Merging and uploading fraud URLs to Firestore")
    try:
        existing_urls = fetch_existing_fraud_urls(db)
        new_set = set(new_urls)
        truly_new = new_set - existing_urls
        merged = existing_urls.union(new_set)
        logging.info(
            "Merge stats: preserved=%d new_in_file=%d added=%d duplicates_skipped=%d total=%d",
            len(existing_urls), len(new_set), len(truly_new), len(new_set & existing_urls), len(merged)
        )
        fraud_data = {
            "urls": sorted(list(merged)),
            "metadata": {
                "upload_timestamp": datetime.now().isoformat(),
                "url_count": len(merged),
                "existing_urls_preserved": len(existing_urls),
                "new_urls_added": len(truly_new),
                "duplicate_urls_skipped": len(new_set & existing_urls),
                "version": "2.0",
                "description": "Known fraudulent job posting domains (merged with user reports)",
                "sources": ["fraud-urls.txt", "user_reports", "fraud_urls_collection"],
            },
        }
        db.collection(FRAUD_DATA_COLLECTION).document("fraud_urls").set(fraud_data)
        logging.info("Uploaded merged fraud URLs to %s/fraud_urls", FRAUD_DATA_COLLECTION)
        return True
    except Exception as e:
        logging.error("Error uploading fraud URLs: %s", e)
        return False


def main(argv=None) -> None:
    if argv is None and len(sys.argv) == 1:
        print("=" * 80)
        print("FRAUDBUSTER Model Uploader")
        print("=" * 80)
        print("Running defaults: --model_type=both --yes")
        print("Common arguments: --model_type legitimate|enhanced|both | --firestore_path PATH | --credentials JSON | --model_path DIR | --yes | --quiet")
        print("Examples:")
        print("  python3 nlp_module/upload_models.py --model_type legitimate --yes")
        print("  python3 nlp_module/upload_models.py --model_type enhanced --credentials /path/creds.json")
        print("  python3 nlp_module/upload_models.py --model_type both --model_path /path/to/artifacts --yes")
        print("Use --help for full usage details.\n")
        args = parse_args(["--model_type", "both", "--yes"])  # ensure full non-interactive default
    else:
        args = parse_args(argv)
    configure_logging(verbose=not args.quiet)
    args = resolve_defaults(args)
    logging.info(
        "Starting upload model_type=%s firestore_path=%s model_path=%s",
        args.model_type,
        args.firestore_path,
        args.model_path,
    )
    db = initialize_firestore(args.credentials)
    module_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(module_dir)
    if args.model_type == "legitimate":
        try:
            files = validate_artifacts(args.model_path, "legit")
        except FileNotFoundError as e:
            logging.warning(str(e))
            if args.yes:
                logging.info("Artifacts missing. Auto-training legitimate model.")
                try:
                    import subprocess
                    import sys as _sys
                    subprocess.check_call([_sys.executable, os.path.join(module_dir, "train_models.py"), "--model_type", "legitimate"], cwd=module_dir)
                except Exception as te:
                    logging.error("Auto-training failed: %s", te)
                    raise RuntimeError("Upload aborted: training failed or data missing")
            else:
                resp = input("Artifacts missing for legitimate model. Run training now? [y/N]: ").strip().lower()
                if resp in ("y", "yes"):
                    try:
                        import subprocess
                        import sys as _sys
                        subprocess.check_call([_sys.executable, os.path.join(module_dir, "train_models.py"), "--model_type", "legitimate"], cwd=module_dir)
                    except Exception as te:
                        logging.error("Training failed: %s", te)
                        raise RuntimeError("Upload aborted: training failed or data missing")
                else:
                    raise RuntimeError("Upload aborted: missing artifacts")
            files = validate_artifacts(args.model_path, "legit")
        collection = args.firestore_path or "nlp_legit_models"
        confirm_overwrite(db, collection, force_yes=args.yes)
        upload_artifacts(db, collection, files)
    elif args.model_type == "enhanced":
        try:
            files = validate_artifacts(args.model_path, "enhanced")
        except FileNotFoundError as e:
            logging.warning(str(e))
            if args.yes:
                logging.info("Artifacts missing. Auto-training enhanced model.")
                try:
                    import subprocess
                    import sys as _sys
                    subprocess.check_call([_sys.executable, os.path.join(module_dir, "train_models.py"), "--model_type", "enhanced"], cwd=module_dir)
                except Exception as te:
                    logging.error("Auto-training failed: %s", te)
                    raise RuntimeError("Upload aborted: training failed or data missing")
            else:
                resp = input("Artifacts missing for enhanced model. Run training now? [y/N]: ").strip().lower()
                if resp in ("y", "yes"):
                    try:
                        import subprocess
                        import sys as _sys
                        subprocess.check_call([_sys.executable, os.path.join(module_dir, "train_models.py"), "--model_type", "enhanced"], cwd=module_dir)
                    except Exception as te:
                        logging.error("Training failed: %s", te)
                        raise RuntimeError("Upload aborted: training failed or data missing")
                else:
                    raise RuntimeError("Upload aborted: missing artifacts")
            files = validate_artifacts(args.model_path, "enhanced")
        collection = args.firestore_path or "nlp_models"
        confirm_overwrite(db, collection, force_yes=args.yes)
        upload_artifacts(db, collection, files)
    else:
        # both
        files_legit = None
        try:
            files_legit = validate_artifacts(args.model_path, "legit")
        except FileNotFoundError as e:
            logging.warning(str(e))
            if args.yes:
                logging.info("Artifacts missing. Auto-training legitimate model.")
                try:
                    import subprocess
                    import sys as _sys
                    subprocess.check_call([_sys.executable, os.path.join(module_dir, "train_models.py"), "--model_type", "legitimate"], cwd=module_dir)
                except Exception as te:
                    logging.error("Auto-training failed: %s", te)
                    if args.model_type != "both":
                        raise RuntimeError("Upload aborted: training failed or data missing")
                    else:
                        logging.info("Skipping legitimate due to training failure")
            else:
                resp = input("Artifacts missing for legitimate model. Run training now? [y/N]: ").strip().lower()
                if resp in ("y", "yes"):
                    try:
                        import subprocess
                        import sys as _sys
                        subprocess.check_call([_sys.executable, os.path.join(module_dir, "train_models.py"), "--model_type", "legitimate"], cwd=module_dir)
                    except Exception as te:
                        logging.error("Training failed: %s", te)
                        if args.model_type != "both":
                            raise RuntimeError("Upload aborted: training failed or data missing")
                        else:
                            logging.info("Skipping legitimate due to training failure")
                else:
                    if args.model_type != "both":
                        raise RuntimeError("Upload aborted: missing artifacts")
                    else:
                        logging.info("Skipping legitimate due to missing artifacts")
            try:
                files_legit = validate_artifacts(args.model_path, "legit")
            except FileNotFoundError:
                files_legit = None
        files_enh = None
        try:
            files_enh = validate_artifacts(args.model_path, "enhanced")
        except FileNotFoundError as e:
            logging.warning(str(e))
            if args.yes:
                logging.info("Artifacts missing. Auto-training enhanced model.")
                try:
                    import subprocess
                    import sys as _sys
                    subprocess.check_call([_sys.executable, os.path.join(module_dir, "train_models.py"), "--model_type", "enhanced"], cwd=module_dir)
                except Exception as te:
                    logging.error("Auto-training failed: %s", te)
                    if args.model_type != "both":
                        raise RuntimeError("Upload aborted: training failed or data missing")
                    else:
                        logging.info("Skipping enhanced due to training failure")
            else:
                resp = input("Artifacts missing for enhanced model. Run training now? [y/N]: ").strip().lower()
                if resp in ("y", "yes"):
                    try:
                        import subprocess
                        import sys as _sys
                        subprocess.check_call([_sys.executable, os.path.join(module_dir, "train_models.py"), "--model_type", "enhanced"], cwd=module_dir)
                    except Exception as te:
                        logging.error("Training failed: %s", te)
                        if args.model_type != "both":
                            raise RuntimeError("Upload aborted: training failed or data missing")
                        else:
                            logging.info("Skipping enhanced due to training failure")
                else:
                    if args.model_type != "both":
                        raise RuntimeError("Upload aborted: missing artifacts")
                    else:
                        logging.info("Skipping enhanced due to missing artifacts")
            try:
                files_enh = validate_artifacts(args.model_path, "enhanced")
            except FileNotFoundError:
                files_enh = None
        confirm_overwrite(db, "nlp_legit_models", force_yes=args.yes)
        if files_legit:
            upload_artifacts(db, "nlp_legit_models", files_legit)
        else:
            logging.info("Skipping upload for legitimate; no artifacts available")
        confirm_overwrite(db, "nlp_models", force_yes=args.yes)
        if files_enh:
            upload_artifacts(db, "nlp_models", files_enh)
        else:
            logging.info("Skipping upload for enhanced; no artifacts available")
    logging.info("Upload complete")

    default_urls_path = args.fraud_urls_path or os.path.join(repo_root, "datasets", "sites", "fraud-urls.txt")
    if os.path.exists(default_urls_path):
        urls = read_fraud_urls(default_urls_path)
        if urls:
            upload_fraud_urls_to_firestore(db, urls)
    else:
        logging.info("No fraud URLs file found; skipping URL upload")


if __name__ == "__main__":
    main()
