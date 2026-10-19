import os
import runpy
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase

BACKEND = Path(__file__).resolve().parents[2]


class StartupTests(SimpleTestCase):
    def bootstrap_debug(self, command, debug=None):
        with (
            patch.dict(os.environ),
            patch.object(sys, "argv", ["manage.py", command]),
            patch("django.core.management.execute_from_command_line"),
        ):
            os.environ.pop("DJANGO_DEBUG", None)
            if debug is not None:
                os.environ["DJANGO_DEBUG"] = debug
            runpy.run_path(str(BACKEND / "manage.py"), run_name="__main__")
            return os.environ.get("DJANGO_DEBUG")

    def test_runserver_defaults_to_local_debug(self):
        self.assertEqual(self.bootstrap_debug("runserver"), "true")

    def test_runserver_respects_explicit_debug(self):
        self.assertEqual(self.bootstrap_debug("runserver", "false"), "false")

    def test_other_commands_do_not_enable_debug(self):
        self.assertIsNone(self.bootstrap_debug("check"))

    def test_production_settings_still_require_secret(self):
        env = os.environ.copy()
        env.pop("DJANGO_SECRET_KEY", None)
        env.pop("DJANGO_DEBUG", None)
        result = subprocess.run(
            [sys.executable, "-c", "import config.wsgi"],
            cwd=BACKEND,
            env=env,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Set DJANGO_SECRET_KEY", result.stderr)
