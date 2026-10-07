"""Layout renderers. Each exposes LAYOUT_META and render_scene()."""
from . import linkedin, innvikta, course, kinetic, cinematic  # noqa: F401

LAYOUTS = {
    "linkedin": linkedin,
    "innvikta": innvikta,
    "course": course,
    "kinetic": kinetic,
    "cinematic": cinematic,
}
