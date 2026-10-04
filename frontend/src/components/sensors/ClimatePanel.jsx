import ClimateCard from './ClimateCard';
import { batteryLevel, humidityLevel, temperatureLevel } from '../../lib/levels';

/** Temperature, humidity, and (only if reported) battery cards. */
export default function ClimatePanel({ sensors }) {
  const temperature = sensors?.temperature ?? null;
  const humidity = sensors?.humidity ?? null;
  const battery = sensors?.battery ?? null;

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${battery !== null ? 'xl:grid-cols-3' : ''}`}>
      <ClimateCard title="Temperature" icon="🌡️" value={temperature} unit="°C" level={temperatureLevel(temperature)} />
      <ClimateCard title="Humidity" icon="💧" value={humidity} unit="%" level={humidityLevel(humidity)} decimals={0} />
      {battery !== null && (
        <ClimateCard title="Battery" icon="🔋" value={battery} unit="%" level={batteryLevel(battery)} decimals={0} />
      )}
    </div>
  );
}
