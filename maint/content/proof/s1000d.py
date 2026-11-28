"""The pump manual's content as S1000D-style data modules (issue 5.0 element names, from the
public schema): one fault isolation module per troubleshooting table and one procedural module
for task 4-3. Isolation steps carry no facets
(the schema has no element for them). Applicability is a `dmStatus/applic` assert on the model attribute; warnings and
cautions are `warningsAndCautions` entries referenced from the step they guard.
Written from the same content as the PDF (pump40_content.py)."""

from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape as x

import pump40_content as C

MODEL = "M40"


def _ident(sys_code: str, info: str, title: str, info_name: str) -> str:
    return f"""<identAndStatusSection>
  <dmAddress>
   <dmIdent>
    <dmCode modelIdentCode="{MODEL}" systemDiffCode="A" systemCode="{sys_code}" subSystemCode="0"
            subSubSystemCode="0" assyCode="00" disassyCode="00" disassyCodeVariant="A"
            infoCode="{info}" infoCodeVariant="A" itemLocationCode="A"/>
    <language languageIsoCode="en" countryIsoCode="US"/>
    <issueInfo issueNumber="003" inWork="00"/>
   </dmIdent>
   <dmAddressItems>
    <issueDate year="2026" month="03" day="01"/>
    <dmTitle><techName>{x(title)}</techName><infoName>{x(info_name)}</infoName></dmTitle>
   </dmAddressItems>
  </dmAddress>
  <dmStatus issueType="changed">
   <security securityClassification="01"/>
   <responsiblePartnerCompany><enterpriseName>Harvest proof (fictional)</enterpriseName></responsiblePartnerCompany>
   <applic>{{applic}}</applic>
   <brexDmRef><dmRef><dmRefIdent><dmCode modelIdentCode="S1000D" systemDiffCode="H" systemCode="04"
     subSystemCode="1" subSubSystemCode="0" assyCode="0301" disassyCode="00" disassyCodeVariant="A"
     infoCode="022" infoCodeVariant="A" itemLocationCode="D"/></dmRefIdent></dmRef></brexDmRef>
   <qualityAssurance><unverified/></qualityAssurance>
  </dmStatus>
 </identAndStatusSection>"""


def _applic(text: str, models: list[str]) -> str:
    if len(models) == 1:
        a = f'<assert applicPropertyIdent="model" applicPropertyType="prodattr" applicPropertyValues="{models[0]}"/>'
    else:
        a = "<evaluate andOr=\"or\">" + "".join(
            f'<assert applicPropertyIdent="model" applicPropertyType="prodattr" applicPropertyValues="{m}"/>'
            for m in models) + "</evaluate>"
    return f"<displayText><simplePara>{x(text)}</simplePara></displayText>{a}"


def _dm(sys_code, info, title, info_name, applic, content) -> str:
    ident = _ident(sys_code, info, title, info_name).replace("{applic}", applic)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<dmodule xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
            'xsi:noNamespaceSchemaLocation="http://www.s1000d.org/S1000D_5-0/xml_schema_flat/fault.xsd">\n '
            f"{ident}\n <content>\n{content}\n </content>\n</dmodule>\n")


def _facets(groups: dict) -> str:
    """S1000D isolation steps have no facet boxes (reason, known info, possible problems); the
    schema's nearest place is none, so the modules carry the question and branches only."""
    return ""


def tree2() -> str:
    warnings = (f'<warningsAndCautions><warning id="warn-0001" applicRefId="app-d"><warningAndCautionPara>{x(C.T2_W1)}'
                f'</warningAndCautionPara></warning><warning id="warn-0002" applicRefId="app-e"><warningAndCautionPara>'
                f'{x(C.T2_W2)}</warningAndCautionPara></warning></warningsAndCautions>')
    ref_applic = ('<referencedApplicGroup>'
                  f'<applic id="app-d">{_applic(C.T2_W1_APPLIES, ["P40-D"])}</applic>'
                  f'<applic id="app-e">{_applic(C.T2_W2_APPLIES, ["P40-E"])}</applic></referencedApplicGroup>')
    body = f"""  {ref_applic}
  {warnings}
  <faultIsolation>
   <faultIsolationProcedure>
    <fault faultCode="M40-T32"><faultDescr><descr>{x(C.T2_TITLE)}</descr></faultDescr></fault>
    <isolationProcedure warningRefs="warn-0001 warn-0002">
     <isolationMainProcedure>
      <isolationStep id="stp-0000"><action>{x(C.SYM2)}</action>
       <isolationStepAnswer><listOfChoices><choice nextActionRefId="stp-0001">Continue</choice></listOfChoices></isolationStepAnswer></isolationStep>
      <isolationStep id="stp-0001"><isolationStepQuestion>{x(C.H1)}</isolationStepQuestion>{_facets(C.H1_FACETS)}
       <isolationStepAnswer><yesNoAnswer><yesAnswer nextActionRefId="stp-0002"/><noAnswer nextActionRefId="end-0001"/></yesNoAnswer></isolationStepAnswer></isolationStep>
      <isolationStep id="stp-0002"><action><para>Do the belt condition check (<dmRef><dmRefIdent>{_dmc("32", "345")}</dmRefIdent></dmRef>).</para></action><isolationStepQuestion>{x(C.H2)}</isolationStepQuestion>{_facets(C.H2_FACETS)}
       <isolationStepAnswer><listOfChoices>
        <choice nextActionRefId="end-0002">{x(C.H2_LABELS[0].title())}</choice>
        <choice nextActionRefId="end-0003">{x(C.H2_LABELS[1].title())}</choice>
        <choice nextActionRefId="end-0004">{x(C.H2_LABELS[2].title())}</choice>
       </listOfChoices></isolationStepAnswer></isolationStep>
      <isolationProcedureEnd id="end-0001"><action>{x(C.H1N)}</action></isolationProcedureEnd>
      <isolationProcedureEnd id="end-0002"><action>{x(C.H2T)}</action></isolationProcedureEnd>
      <isolationProcedureEnd id="end-0003"><action>{x(C.H2L)}</action></isolationProcedureEnd>
      <isolationProcedureEnd id="end-0004"><action>{x(C.H2B)}</action></isolationProcedureEnd>
     </isolationMainProcedure>
    </isolationProcedure>
   </faultIsolationProcedure>
  </faultIsolation>"""
    return _dm("32", "421", C.T2_TITLE, "Fault isolation procedure", _applic(C.T2_APPLIES, ["P40-D", "P40-E"]), body)


def task43() -> str:
    reqs = (f"<reqPersons><person man=\"A\"/><personnelDescr>{x(C.T43_SETUP[3][2])}</personnelDescr></reqPersons>"
            f"<reqSupportEquips><supportEquipDescrGroup>"
            f"<supportEquipDescr><name>10 mm wrench</name><reqQuantity>1</reqQuantity></supportEquipDescr>"
            f"<supportEquipDescr><name>Battery lifting strap</name><reqQuantity>1</reqQuantity></supportEquipDescr>"
            f"</supportEquipDescrGroup></reqSupportEquips>"
            f"<reqSupplies><supplyDescrGroup><supplyDescr><name>Terminal grease</name></supplyDescr></supplyDescrGroup></reqSupplies>"
            f"<reqSpares><spareDescrGroup><spareDescr><name>Battery, 12 V, 100 Ah</name><partRef partNumberValue=\"P40-118\"/>"
            f"<reqQuantity>1</reqQuantity></spareDescr></spareDescrGroup></reqSpares>")
    wc = (f'<warningsAndCautions><caution id="caut-0001"><warningAndCautionPara>{x(C.T43_CAUTION)}</warningAndCautionPara>'
          f'</caution><warning id="warn-0001"><warningAndCautionPara>{x(C.T43_WARNING)}</warningAndCautionPara></warning>'
          f'</warningsAndCautions>')
    guard = {1: ' cautionRefs="caut-0001"', 2: ' warningRefs="warn-0001"'}
    steps = "\n".join(f'    <proceduralStep id="stp-{i + 1:04d}"{guard.get(i, "")}><para>{x(s)}</para></proceduralStep>'
                      for i, s in enumerate(C.T43_STEPS))
    body = f"""  {wc}
  <procedure>
   <preliminaryRqmts>
    <reqCondGroup><noConds/></reqCondGroup>
    {reqs}
    <reqSafety><noSafety/></reqSafety>
   </preliminaryRqmts>
   <mainProcedure>
{steps}
   </mainProcedure>
   <closeRqmts><reqCondGroup><noConds/></reqCondGroup></closeRqmts>
  </procedure>"""
    return _dm("24", "920", C.T43_TITLE, "Replace", _applic(C.T43_APPLIES, ["P40-D"]), body)


def _dmc(sys_code: str, info: str) -> str:
    return (f'<dmCode modelIdentCode="{MODEL}" systemDiffCode="A" systemCode="{sys_code}" subSystemCode="0" '
            f'subSubSystemCode="0" assyCode="00" disassyCode="00" disassyCodeVariant="A" infoCode="{info}" '
            f'infoCodeVariant="A" itemLocationCode="A"/>')


def belt_check() -> str:
    """The test procedure for the belt question, its own module (the fault module points here by dmRef)."""
    wc = (f'<warningsAndCautions><warning id="warn-0001"><warningAndCautionPara>{x(C.TPH2_WARNING)}'
          f'</warningAndCautionPara></warning></warningsAndCautions>')
    steps = [f'    <proceduralStep id="stp-0001"><para>{x(C.TPH2_STEPS[0])}</para></proceduralStep>',
             f'    <proceduralStep id="stp-0002"><note><notePara>{x(C.TPH2_NOTE)}</notePara></note>'
             f'<para>{x(C.TPH2_STEPS[1])}</para></proceduralStep>',
             f'    <proceduralStep id="stp-0003"><para>{x(C.TPH2_STEPS[2])}</para></proceduralStep>']
    body = f"""  {wc}
  <procedure>
   <preliminaryRqmts>
    <reqCondGroup><noConds/></reqCondGroup>
    <reqSafety><safetyRqmts warningRefs="warn-0001"/></reqSafety>
   </preliminaryRqmts>
   <mainProcedure>
{chr(10).join(steps)}
   </mainProcedure>
   <closeRqmts><reqCondGroup><noConds/></reqCondGroup></closeRqmts>
  </procedure>"""
    return _dm("32", "345", C.TPH2_TITLE, "Test", _applic(C.T2_APPLIES, ["P40-D", "P40-E"]), body)


def act() -> str:
    """Applicability cross-reference table: the product attributes and their values."""
    enums = "".join(f'<enumeration applicPropertyValues="{m}" enumerationLabel="{x(name)}"/>'
                    for name, m in ((C.VARIANTS[0][0], "P40-D"), (C.VARIANTS[1][0], "P40-E")))
    body = f"""  <applicCrossRefTable>
   <productAttributeList>
    <productAttribute id="model"><name>Model</name><displayName>Model</displayName><descr>Model designation</descr>{enums}</productAttribute>
    <productAttribute id="serialno"><name>Serial number</name><displayName>Serial number</displayName><descr>Serial number range</descr></productAttribute>
   </productAttributeList>
  </applicCrossRefTable>"""
    return _dm("00", "00W", "Model 40 utility pump", "Applicability cross-reference table",
               "<displayText><simplePara>All</simplePara></displayText>", body)


def pct() -> str:
    """Products cross-reference table: each product's attribute values (model and serial range)."""
    prods = "".join(
        f'<product id="prd-{k}"><assign applicPropertyIdent="model" applicPropertyType="prodattr" applicPropertyValue="{m}"/>'
        f'<assign applicPropertyIdent="serialno" applicPropertyType="prodattr" applicPropertyValue="{sn}"/></product>'
        for k, (m, sn) in enumerate((("P40-D", "P40D-1000~P40D-4999"), ("P40-E", "P40E-1000~P40E-4999")), 1))
    body = f"  <productCrossRefTable>{prods}</productCrossRefTable>"
    return _dm("00", "00P", "Model 40 utility pump", "Products cross-reference table",
               "<displayText><simplePara>All</simplePara></displayText>", body)


def write_set(out_zip: Path) -> Path:
    """The publication's data module set as one zip (how S1000D data is delivered), byte-stable."""
    import zipfile
    files = {
        f"DMC-{MODEL}-A-00-0-0-00-00A-00WA-A_003-00_EN-US.XML": act(),
        f"DMC-{MODEL}-A-00-0-0-00-00A-00PA-A_003-00_EN-US.XML": pct(),
        f"DMC-{MODEL}-A-32-0-0-00-00A-421A-A_003-00_EN-US.XML": tree2(),
        f"DMC-{MODEL}-A-32-0-0-00-00A-345A-A_003-00_EN-US.XML": belt_check(),
        f"DMC-{MODEL}-A-24-0-0-00-00A-920A-A_003-00_EN-US.XML": task43(),
    }
    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for name in sorted(files):
            zi = zipfile.ZipInfo(name, date_time=(2026, 3, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, files[name])
    return out_zip


def write_modules(out: Path) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    files = {
        f"DMC-{MODEL}-A-32-0-0-00-00A-421A-A_003-00_EN-US.XML": tree2(),
        f"DMC-{MODEL}-A-24-0-0-00-00A-920A-A_003-00_EN-US.XML": task43(),
    }
    paths = []
    for name, text in files.items():
        p = out / name
        p.write_text(text)
        paths.append(p)
    return paths


def expected() -> dict:
    """The answer key for what the two modules carry: the overheating tree (S1000D has no facets) and
    task 4-3, with their warnings, cautions, setup and applicability."""
    x = C.expected()
    x["trees"] = [dict(t, facets=[]) for t in x["trees"] if t["title"] == C.T2_TITLE]   # no facets in S1000D
    x["procedures"] = [p for p in x["procedures"] if p["title"] in (C.T43_TITLE, C.TPH2_TITLE)]
    keep = {"tree:" + C.T2_TITLE, "procedure:" + C.TPH2_TITLE} | {"step:" + s for s in C.T43_STEPS + C.TPH2_STEPS}
    x["guards"] = [g for g in x["guards"] if g["guards"] in keep]
    x["symptoms"], x["signals"] = [], []
    x["variant"] = "s1000d"
    return x
