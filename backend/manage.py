#!/usr/bin/env python
import os
import sys

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    # runserver is for local development; respect explicit environment values.
    if sys.argv[1:2] == ["runserver"]:
        os.environ.setdefault("DJANGO_DEBUG", "true")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
