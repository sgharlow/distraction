interface ActionItemProps {
  text: string;
}

export function ActionItem({ text }: ActionItemProps) {
  return (
    <div className="bg-action rounded-[6px] p-2.5">
      <div className="text-[9px] font-sans font-semibold text-action-light tracking-[2px] mb-0.5">
        IF YOU ONLY DO ONE THING
      </div>
      <p className="text-[13.5px] text-action-light leading-snug m-0">{text}</p>
    </div>
  );
}
