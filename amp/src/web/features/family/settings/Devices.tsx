import { useQuery } from "@tanstack/react-query";
import { formatJoinCode } from "../../../../schools/contracts";
import { PageSection } from "../../../ui/PageSection";
import { RowButton, RowList } from "../../../ui/RowList";
import { useSheet } from "../../../nav/sheet";
import { presenceOptions } from "../../school/classes/api";
import { DevicesSheet } from "../Devices";
import type { FamilyPlace } from "../FamilyFrame";
import { DeviceModeChoice } from "../Practice";

/**
 * Settings › Devices (the IA v2 spec, §3.5): shared or their own devices,
 * saved on choice, then their own devices (the code and QR, a new code,
 * sign-in cards, pictures and sign-outs) in a sheet over Settings.
 */
export function DevicesSection({ place }: { place: FamilyPlace }) {
  const own = place.own;
  const manage = !!place.data?.children.some(
    (child) => child.capabilities.manageDevices,
  );
  const where = own ? { org: own.org, class: own.id } : null;
  const presence = useQuery({
    ...presenceOptions(place.session, where ?? { org: "", class: "" }),
    enabled: !!where && manage,
  });
  const devices = useSheet("devices");
  if (!own || !manage) return null;
  const code = presence.data?.class.joinCode;
  return (
    <PageSection
      title="Devices"
      titleId="family-practice"
      data-settings-devices=""
    >
      <DeviceModeChoice place={place} />
      <RowList label="Their own devices">
        <RowButton
          title="Their own devices"
          meta={
            code
              ? `${place.words.Code} ${formatJoinCode(code)}`
              : "A code, a QR code or a printed card"
          }
          data-own-devices=""
          onClick={devices.show}
        />
      </RowList>
      <DevicesSheet
        place={place}
        classId={own.id}
        open={devices.open}
        onOpenChange={devices.onOpenChange}
      />
    </PageSection>
  );
}
