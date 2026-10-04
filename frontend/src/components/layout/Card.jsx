import { useTilt } from '../../hooks/useTilt';

/**
 * Glass panel surface. `tilt` adds the pointer-driven 3D tilt + highlight;
 * keep it off for panels with drag interactions (3D orbit) or pixel-aligned
 * overlays (camera bounding boxes). `alert` adds the red danger glow.
 */
export default function Card({ as: Tag = 'section', tilt = false, alert = false, className = '', children, ...rest }) {
  const { ref, active, handlers } = useTilt(tilt);

  return (
    <Tag
      ref={ref}
      className={`card ${alert ? 'card-alert' : ''} ${active ? 'tilt tilt-glare' : ''} ${className}`}
      {...handlers}
      {...rest}
    >
      {children}
    </Tag>
  );
}
