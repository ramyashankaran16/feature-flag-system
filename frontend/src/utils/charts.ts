import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement,
  PointElement, Tooltip,
} from 'chart.js';
import { tokens } from '../theme';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

ChartJS.defaults.font.family = '"Public Sans", system-ui, sans-serif';
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = tokens.muted;
ChartJS.defaults.borderColor = tokens.line;
ChartJS.defaults.plugins.legend.labels.boxWidth = 10;
ChartJS.defaults.plugins.legend.labels.boxHeight = 10;

export const ON_COLOR = tokens.signal;
export const OFF_COLOR = tokens.off;
