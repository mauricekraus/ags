import Gtk from 'gi://Gtk?version=4.0';
import Widget from './widget.js';
import { typecheck, runCmd, restcheck, warning } from './utils.js';

function _orientation(str) {
    if (str === 'v')
        str = 'vertical';

    if (str === 'h')
        str = 'horizontal';

    try {
        return Gtk.Orientation[str.toUpperCase()];
    } catch (error) {
        warning('wrong orientation value');
    }

    return Gtk.Orientation.HORIZONTAL;
}

export function Box({ type,
    orientation = 'horizontal',
    homogeneous = false,
    children = [],
    ...rest
}) {
    typecheck('orientation', orientation, 'string', type);
    typecheck('homogeneous', homogeneous, 'boolean', type);
    typecheck('children', children, 'array', type);
    restcheck(rest, type);

    const box = new Gtk.Box({
        orientation: _orientation(orientation),
        homogeneous,
    });

    children.forEach(w => box.append(Widget(w)));

    return box;
}

export function CenterBox({ type,
    startWidget,
    centerWidget,
    endWidget,
    ...rest
}) {
    restcheck(rest, type);

    const box = new Gtk.CenterBox({
        start_widget: Widget(startWidget),
        center_widget: Widget(centerWidget),
        end_widget: Widget(endWidget),
    });

    return box;
}

export function Icon({ type,
    iconName = '',
    ...rest
}) {
    typecheck('iconName', iconName, 'string', type);
    restcheck(rest, type);

    return Gtk.Image.new_from_icon_name(iconName);
}

export function Label({ type,
    label = '',
    markup = false,
    wrap = false,
    maxWidth = -1,
    justify = 'center',
    xalign = 0.5,
    yalign = 0.5,
    ...rest
}) {
    typecheck('label', label, 'string', type);
    typecheck('markup', markup || false, 'boolean', type);
    typecheck('wrap', wrap || false, 'boolean', type);
    typecheck('justify', justify || '', 'string', type);
    typecheck('xalign', xalign, 'number', type);
    typecheck('yalign', yalign, 'number', type);
    restcheck(rest, type);

    const lbl = new Gtk.Label({
        label,
        use_markup: markup,
        max_width_chars: maxWidth,
        wrap,
        xalign,
        yalign,
    });

    try {
        lbl.justify = Gtk.Justification[justify.toUpperCase()];
    } catch (error) {
        warning('wrong justify value');
    }

    return lbl;
}

export function Button({ type,
    child,
    onClick = '',
    ...rest
}) {
    typecheck('onClick', onClick, ['string', 'function'], type);
    restcheck(rest, type);

    const btn = new Gtk.Button();

    if (child)
        btn.set_child(Widget(child));

    btn.connect('clicked', () => runCmd(onClick, btn));

    return btn;
}

export function Slider({ type,
    inverted = false,
    orientation = 'horizontal',
    min = 0,
    max = 1,
    value = 0,
    onChange = '',
    drawValue = false,
    ...rest
}) {
    typecheck('inverted', inverted, 'boolean', type);
    typecheck('orientation', orientation, 'string', type);
    typecheck('min', min, 'number', type);
    typecheck('max', max, 'number', type);
    typecheck('onChange', onChange, ['string', 'function'], type);
    typecheck('value', value, 'number', type);
    typecheck('drawValue', drawValue, 'boolean', type);
    restcheck(rest, type);

    const slider = Widget({
        type: () => new Gtk.Scale({
            orientation: _orientation(orientation),
            adjustment: new Gtk.Adjustment({
                value: min,
                lower: min,
                upper: max,
                step_increment: (max - min) / 100,
            }),
            drawValue,
            inverted,
        }),
        onButtonPressed: slider => slider._dragging = true,
        onButtonReleased: slider => slider._dragging = false,
        onScroll: (slider, _dx, dy) => {
            const { adjustment } = slider;

            slider._dragging = true;
            dy > 0
                ? adjustment.value -= adjustment.step_increment
                : adjustment.value += adjustment.step_increment;

            slider._dragging = false;
        },
    });

    if (onChange) {
        slider.adjustment.connect('notify::value', ({ value }) => {
            if (!slider._dragging)
                return;

            typeof onChange === 'function'
                ? onChange(slider, value)
                : runCmd(onChange.replace(/\{\}/g, value));
        });
    }

    return slider;
}

export function Stack({ type,
    items = [],
    hhomogeneous = true,
    vhomogeneous = true,
    interpolateSize = false,
    transition = 'none',
    transitionDuration = 200,
    ...rest
} = {}) {
    typecheck('hhomogeneous', hhomogeneous, 'boolean', type);
    typecheck('vhomogeneous', vhomogeneous, 'boolean', type);
    typecheck('interpolateSize', interpolateSize, 'boolean', type);
    typecheck('transition', transition, 'string', type);
    typecheck('transitionDuration', transitionDuration, 'number', type);
    typecheck('items', items, 'array', type);
    restcheck(rest, type);

    const stack = new Gtk.Stack({
        hhomogeneous,
        vhomogeneous,
        interpolateSize,
        transitionDuration,
    });

    try {
        stack.transitionType = Gtk.StackTransitionType[transition.toUpperCase()];
    } catch (error) {
        error('wrong interpolate value');
    }

    items.forEach(([name, widget]) => {
        stack.add_named(Widget(widget), name);
    });

    stack.showChild = name => {
        stack.set_visible_child_name(typeof name === 'function' ? name() : name);
    };
    return stack;
}

export function Entry({ type,
    text = '',
    placeholderText = '',
    visibility = false,
    onChange = '',
    onAccept = '',
    ...rest
}) {
    typecheck('text', text, 'string', type);
    typecheck('placeholderText', placeholderText, 'string', type);
    typecheck('onChange', onChange, ['string', 'function'], type);
    typecheck('onAccept', onAccept, ['string', 'function'], type);
    typecheck('visibility', visibility, 'boolean', type);
    restcheck(rest, type);

    const entry = new Gtk.Entry({
        placeholderText,
        visibility,
        text,
    });

    if (onAccept) {
        entry.connect('activate', ({ buffer }) => {
            typeof onAccept === 'function'
                ? onAccept(entry, buffer.text)
                : runCmd(onAccept.replace(/\{\}/g, buffer.text));
        });
    }

    if (onChange) {
        entry.buffer.connect('notify::text', ({ text }) => {
            typeof onAccept === 'function'
                ? onChange(entry, text)
                : runCmd(onChange.replace(/\{\}/g, text));
        });
    }

    return entry;
}

export function Scrollable({ type,
    child,
    hscroll = 'automatic',
    vscroll = 'automatic',
    ...rest
}) {
    typecheck('hscroll', hscroll, 'string', type);
    typecheck('vscroll', vscroll, 'string', type);
    restcheck(rest, type);

    const scrollable = new Gtk.ScrolledWindow({
        hadjustment: new Gtk.Adjustment(),
        vadjustment: new Gtk.Adjustment(),
    });

    try {
        scrollable.set_policy(
            Gtk.PolicyType[hscroll.toUpperCase()],
            Gtk.PolicyType[vscroll.toUpperCase()],
        );
    } catch (error) {
        error('wrong scroll policy');
    }

    if (child)
        scrollable.set_child(Widget(child));

    return scrollable;
}

export function Revealer({ type,
    transition = 'crossfade',
    transitionDuration = 250,
    child,
    ...rest
}) {
    typecheck('transition', transition, 'string', type);
    typecheck('transitionDuration', transitionDuration, 'number', type);
    restcheck(rest, type);

    const revealer = new Gtk.Revealer({
        transitionDuration,
    });

    try {
        revealer.transitionType = Gtk.RevealerTransitionType[transition.toUpperCase()];
    } catch (error) {
        error('wrong transition type');
    }

    if (child)
        revealer.set_child(Widget(child));

    return revealer;
}

export function Overlay({ type,
    children = [],
    passthrough = true,
    ...rest
}) {
    typecheck('children', children, 'array', type);
    typecheck('passthrough', passthrough, 'boolean', type);
    restcheck(rest, type);

    const overlay = new Gtk.Overlay();

    if (children[0]) {
        overlay.set_child(Widget(children[0]));
        children.splice(1).forEach(ch => overlay.add_overlay(Widget(ch)));
    }

    if (passthrough)
        overlay.get_children().forEach(ch => overlay.set_overlay_pass_through(ch, true));

    return overlay;
}

export function ProgressBar({ type,
    fraction = 0,
    inverted = false,
    orientation = 'horizontal',
    ...rest
}) {
    typecheck('fraction', fraction, 'number', type);
    typecheck('inverted', inverted, 'boolean', type);
    typecheck('orientation', orientation, 'string', type);
    restcheck(rest, type);

    const bar = new Gtk.ProgressBar({
        orientation: _orientation(orientation),
        inverted,
        fraction,
    });

    return bar;
}

export function Switch({ type,
    active = false,
    onActivate = '',
    ...rest
}) {
    typecheck('active', active, 'boolean', type);
    typecheck('onActivate', onActivate, ['string', 'function'], type);
    restcheck(rest, type);

    const gtkswitch = new Gtk.Switch({ active });
    if (onActivate) {
        gtkswitch.connect('notify::active', ({ active }) => {
            typeof onActivate === 'function'
                ? onActivate(gtkswitch, active)
                : runCmd(onActivate.replace(/\{\}/g, active));
        });
    }

    return gtkswitch;
}
