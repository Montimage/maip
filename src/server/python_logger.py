#!/usr/bin/env python3
"""
Optimized Logging System for MAIP Python Scripts

Provides configurable logging levels to replace excessive print statements
"""

import logging
import os
import sys
from datetime import datetime

class MAIPLogger:
    """Custom logger for MAIP Python scripts with performance optimizations"""

    def __init__(self, name: str, log_level: str = None):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)

        # Prevent duplicate handlers
        if not self.logger.handlers:
            # Console handler for important messages only
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(logging.INFO)

            # File handler for detailed logs (if needed)
            log_file = os.path.join(os.path.dirname(__file__), '..', '..', 'logs', f'{name}.log')
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            file_handler = logging.FileHandler(log_file)
            file_handler.setLevel(logging.DEBUG)

            # Formatters
            simple_format = logging.Formatter('%(levelname)s: %(message)s')
            detailed_format = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
            )

            console_handler.setFormatter(simple_format)
            file_handler.setFormatter(detailed_format)

            self.logger.addHandler(console_handler)
            self.logger.addHandler(file_handler)

        # Set log level based on environment
        if log_level:
            self.logger.setLevel(getattr(logging, log_level.upper()))
        elif os.getenv('NODE_ENV') == 'production' or os.getenv('VERBOSE_LOGS') != 'true':
            self.logger.setLevel(logging.WARNING)  # Only warnings and errors
        else:
            self.logger.setLevel(logging.INFO)  # Normal info messages

    def debug(self, message: str):
        """Debug level - only in development"""
        self.logger.debug(message)

    def info(self, message: str):
        """Info level - normal operation messages"""
        self.logger.info(message)

    def warning(self, message: str):
        """Warning level - non-critical issues"""
        self.logger.warning(message)

    def error(self, message: str):
        """Error level - critical errors"""
        self.logger.error(message)

    def critical(self, message: str):
        """Critical level - system failures"""
        self.logger.critical(message)

    def progress(self, message: str, show_in_production: bool = False):
        """Progress messages - only show in development unless critical"""
        if show_in_production or os.getenv('VERBOSE_LOGS') == 'true':
            self.info(message)
        else:
            self.debug(message)

# Global logger instances
def get_logger(name: str) -> MAIPLogger:
    """Get a logger instance for a module"""
    return MAIPLogger(name)

def print_banner(title: str, width: int = 80):
    """Print a formatted banner - only in development"""
    if os.getenv('VERBOSE_LOGS') == 'true':
        print("=" * width)
        print(title.center(width))
        print("=" * width)

def print_section(title: str, width: int = 60):
    """Print a formatted section header - only in development"""
    if os.getenv('VERBOSE_LOGS') == 'true':
        print(f"\n{'=' * width}")
        print(title)
        print("=" * width)

def print_status(message: str, show_always: bool = False):
    """Print status message - only in development unless critical"""
    if show_always or os.getenv('VERBOSE_LOGS') == 'true':
        print(f"✓ {message}")
    else:
        # Use logger for production
        logger = get_logger('status')
        logger.info(message)

def print_warning(message: str):
    """Print warning message - always shown"""
    print(f"⚠️  {message}")

def print_error(message: str):
    """Print error message - always shown"""
    print(f"❌ {message}")

def print_success(message: str):
    """Print success message - only in development"""
    if os.getenv('VERBOSE_LOGS') == 'true':
        print(f"✅ {message}")
    else:
        # Use logger for production
        logger = get_logger('status')
        logger.info(message)
