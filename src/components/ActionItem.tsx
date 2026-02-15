interface ActionItemProps {
  text: string;
}

export function ActionItem({ text }: ActionItemProps) {
  return (
    <div className="bg-action rounded-md p-2.5">
      <div className="text-[11.5px] font-extrabold text-action-light tracking-widest mb-0.5">
        IF YOU ONLY DO ONE THING
      </div>
      <p className="text-[13.5px] text-action-light leading-snug m-0">{text}</p>
    </div>
  );
}
