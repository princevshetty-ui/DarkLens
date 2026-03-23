"""
Web crawler service for batch URL analysis.
Uses Playwright to take screenshots of e-commerce pages for dark pattern detection.
"""

import asyncio
import logging
from typing import Optional
from io import BytesIO
from PIL import Image
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

logger = logging.getLogger(__name__)

# Configuration
BROWSER_TIMEOUT = 30000  # 30 seconds
PAGE_TIMEOUT = 25000  # 25 seconds
MAX_WAIT_TIME = 20000  # 20 seconds
COMPRESSION_TARGET = 1.5 * 1024 * 1024  # 1.5 MB

# Allowlist of e-commerce platforms (Indian focus)
ALLOWED_DOMAINS = {
    "flipkart.com",
    "amazon.in",
    "amazon.com",
    "myntra.com",
    "paytm.com",
    "snapdeal.com",
    "meesho.com",
}

# ── Login Wall Detection ──
# URL path fragments that indicate a login/authentication page
_LOGIN_URL_PATTERNS = [
    "/login", "/signin", "/sign-in", "/sign_in",
    "/auth", "/account/login", "/user/login",
    "/ap/signin", "/gp/aw/d/signin",   # Amazon
]

# Page title substrings that indicate a login page (checked lowercase)
_LOGIN_TITLE_KEYWORDS = [
    "sign in", "signin", "log in", "login", "log-in",
    "create account", "register", "verify otp", "enter otp",
]


class LoginWallDetected(Exception):
    """Raised when the crawler is redirected to a login / authentication page."""


def is_url_allowed(url: str) -> bool:
    """Check if URL is from an allowed e-commerce platform."""
    if not url:
        return False
    url_lower = url.lower()
    return any(domain in url_lower for domain in ALLOWED_DOMAINS)


def is_login_page(url: str, title: str) -> bool:
    """
    Return True if *url* or *title* indicate a login/auth wall.

    Checks:
    1. URL path contains a known authentication path fragment.
    2. Page title (lowercase) contains a known sign-in keyword.
    """
    url_lower = url.lower()
    for pattern in _LOGIN_URL_PATTERNS:
        if pattern in url_lower:
            return True

    title_lower = title.lower()
    for keyword in _LOGIN_TITLE_KEYWORDS:
        if keyword in title_lower:
            return True

    return False


async def crawl_and_screenshot(
    url: str,
    page_selector: Optional[str] = None,
    custom_waiters: Optional[list[str]] = None
) -> Optional[bytes]:
    """
    Crawl a URL and take a screenshot.

    Args:
        url: Target URL to crawl
        page_selector: Optional CSS selector to wait for element
        custom_waiters: Optional list of selectors to wait for

    Returns:
        Image bytes (compressed), or None if failed

    Raises:
        LoginWallDetected: If the page redirects to a login/authentication wall.
        ValueError: If the URL domain is not in the allowlist.
    """

    # Validate URL
    if not is_url_allowed(url):
        logger.warning(f"URL not allowed: {url}")
        raise ValueError(f"Domain not in allowlist. Allowed: {', '.join(ALLOWED_DOMAINS)}")

    # Ensure URL has scheme
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    browser = None
    try:
        async with async_playwright() as p:
            logger.info(f"[Crawler] Launching browser for {url}")

            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 1024},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            page = await context.new_page()

            try:
                # Navigate with timeout
                logger.info(f"[Crawler] Navigating to {url}")
                await page.goto(url, timeout=PAGE_TIMEOUT, wait_until="networkidle")

                # ── Login wall detection ──
                final_url = page.url
                page_title = await page.title()
                if is_login_page(final_url, page_title):
                    logger.warning(
                        f"[Crawler] Login wall detected: url={final_url!r} title={page_title!r}"
                    )
                    raise LoginWallDetected(
                        f"This page requires you to be logged in "
                        f"(redirected to: {final_url}). "
                        f"DarkLens can only scan public pages — try a product listing "
                        f"or search results URL instead."
                    )

                # Wait for custom selectors if provided
                if page_selector:
                    try:
                        logger.info(f"[Crawler] Waiting for selector: {page_selector}")
                        await page.wait_for_selector(page_selector, timeout=MAX_WAIT_TIME)
                    except PlaywrightTimeoutError:
                        logger.warning(f"[Crawler] Selector not found: {page_selector}, proceeding with screenshot")

                # Wait for any custom waiters
                if custom_waiters:
                    for selector in custom_waiters:
                        try:
                            await page.wait_for_selector(selector, timeout=5000)
                            logger.info(f"[Crawler] Found selector: {selector}")
                        except PlaywrightTimeoutError:
                            logger.debug(f"[Crawler] Selector not found: {selector}")

                # Add small delay for dynamic content
                await asyncio.sleep(1)

                # Dismiss common overlays
                try:
                    await page.click('[aria-label="Close"]', timeout=3000)
                    logger.debug("[Crawler] Dismissed close button overlay")
                except Exception:
                    pass

                # Take screenshot
                logger.info(f"[Crawler] Taking screenshot of {url}")
                screenshot_bytes = await page.screenshot(full_page=True)

                # Compress if needed
                if len(screenshot_bytes) > COMPRESSION_TARGET:
                    logger.info(f"[Crawler] Compressing image ({len(screenshot_bytes) / 1024 / 1024:.2f}MB)")
                    screenshot_bytes = compress_image(screenshot_bytes)
                    logger.info(f"[Crawler] Compressed to {len(screenshot_bytes) / 1024 / 1024:.2f}MB")

                logger.info(f"[Crawler] ✅ Screenshot captured: {len(screenshot_bytes) / 1024:.1f}KB")
                return screenshot_bytes

            except (PlaywrightTimeoutError, LoginWallDetected):
                raise
            except Exception as e:
                logger.error(f"[Crawler] Failed to screenshot {url}: {str(e)}")
                raise
            finally:
                await context.close()

    except (LoginWallDetected, ValueError):
        raise
    except Exception as e:
        logger.error(f"[Crawler] Crawl failed for {url}: {str(e)}")
        if browser:
            await browser.close()
        raise
    finally:
        if browser:
            await browser.close()


def compress_image(image_bytes: bytes, quality: int = 75, max_width: int = 1280) -> bytes:
    """
    Compress image to reduce size while maintaining aspect ratio and quality.

    Args:
        image_bytes: Raw image bytes (PNG/JPG)
        quality: JPEG quality (1-95)
        max_width: Maximum width in pixels

    Returns:
        Compressed image bytes
    """
    try:
        img = Image.open(BytesIO(image_bytes))

        if img.width > max_width:
            ratio = max_width / img.width
            new_height = int(img.height * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            logger.debug(f"[Crawler] Resized: {img.width}x{img.height}")

        if img.mode in ("RGBA", "LA", "P"):
            rgb_img = Image.new("RGB", img.size, (255, 255, 255))
            rgb_img.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = rgb_img

        output = BytesIO()
        img.save(output, format="JPEG", quality=quality, optimize=True)
        compressed = output.getvalue()

        logger.debug(f"[Crawler] Compression: {len(image_bytes) / 1024:.1f}KB → {len(compressed) / 1024:.1f}KB")
        return compressed

    except Exception as e:
        logger.warning(f"[Crawler] Compression failed: {str(e)}, returning original")
        return image_bytes


async def batch_crawl_and_screenshot(
    urls: list[str],
    page_selector: Optional[str] = None,
    max_concurrent: int = 2
) -> dict[str, dict]:
    """
    Crawl and screenshot multiple URLs concurrently.

    Args:
        urls: List of target URLs
        page_selector: Optional CSS selector to wait for
        max_concurrent: Max concurrent browser instances

    Returns:
        Dict mapping URL → {"status", "image_bytes", "error"}
    """

    results = {}
    semaphore = asyncio.Semaphore(max_concurrent)

    async def crawl_with_semaphore(url: str):
        async with semaphore:
            try:
                logger.info(f"[Crawler] Starting crawl for {url}")
                image_bytes = await crawl_and_screenshot(url, page_selector)
                results[url] = {
                    "status": "success",
                    "image_bytes": image_bytes,
                    "error": None
                }
                logger.info(f"[Crawler] ✅ Success: {url}")
            except Exception as e:
                logger.error(f"[Crawler] ❌ Failed: {url} - {str(e)}")
                results[url] = {
                    "status": "error",
                    "image_bytes": None,
                    "error": str(e)
                }

    tasks = [crawl_with_semaphore(url) for url in urls]
    await asyncio.gather(*tasks, return_exceptions=True)

    successful = sum(1 for r in results.values() if r["status"] == "success")
    logger.info(f"[Crawler] Batch complete: {successful}/{len(urls)} successful")

    return results
