interface InkleafLogoProps {
  size?: number;
  className?: string;
}

export default function InkleafLogo({ size = 20, className = "" }: InkleafLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 480 480"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="inkleaf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <g>
        <path
          d="M125.27,324.319l-9.951,-3.525c22.539,-138.787 125.223,-235.929 295.275,-285.394c0.721,61.006 -52.027,136.73 -106.95,188.906c-52.351,49.38 -93.049,71.676 -158.694,106.984l-13.04,-4.619c36.423,-66.85 123.89,-158.435 192.078,-226.752c-66.653,56.107 -147.169,127.869 -198.717,224.4Z"
          fill="url(#inkleaf-grad)"
        />
        <path
          d="M111.249,327.769c-4.812,2.682 -6.885,6.187 -6.394,10.462c9.946,7.945 20.032,12.329 30.225,13.95c3.791,-3.053 6.098,-7.23 5.812,-13.369c-11.128,-2.138 -20.884,-4.871 -29.644,-11.044Z"
          fill="url(#inkleaf-grad)"
        />
        <path
          d="M69.399,444.6l8.137,-69.75l23.831,-27.319l28.481,10.463l-6.103,38.362l-54.347,48.244Zm0,0l26.738,-50.569l-0.705,-0.705c0.416,0.081 0.846,0.124 1.286,0.124c3.529,0 6.394,-2.735 6.394,-6.103c0,-3.368 -2.865,-6.103 -6.394,-6.103c-3.529,0 -6.394,2.735 -6.394,6.103c0,1.07 0.289,2.075 0.796,2.95l-21.721,54.303Z"
          fill="url(#inkleaf-grad)"
        />
      </g>
    </svg>
  );
}
