#!/usr/bin/env python3
"""Google Ads CLI for managing conversions from the terminal."""

import argparse
import sys
from pathlib import Path

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException


CONFIG_PATH = Path(__file__).parent / "google-ads.yaml"


def get_client():
    if not CONFIG_PATH.exists():
        print(f"Error: {CONFIG_PATH} not found.", file=sys.stderr)
        print("Copy google-ads.yaml.example to google-ads.yaml and fill in credentials.", file=sys.stderr)
        sys.exit(1)
    return GoogleAdsClient.load_from_storage(str(CONFIG_PATH))


def list_conversions(args):
    """List all conversion actions for the given customer."""
    client = get_client()
    ga_service = client.get_service("GoogleAdsService")

    query = """
        SELECT
            conversion_action.id,
            conversion_action.name,
            conversion_action.category,
            conversion_action.type,
            conversion_action.status,
            conversion_action.tag_snippets
        FROM conversion_action
    """

    response = ga_service.search(customer_id=args.customer_id, query=query)

    count = 0
    for row in response:
        ca = row.conversion_action
        print(f"ID: {ca.id}")
        print(f"  Name:     {ca.name}")
        print(f"  Category: {ca.category.name}")
        print(f"  Type:     {ca.type_.name}")
        print(f"  Status:   {ca.status.name}")
        if ca.tag_snippets:
            for snippet in ca.tag_snippets:
                print(f"  Tag type: {snippet.type_.name}")
                print(f"  Snippet:  {snippet.event_snippet}")
        print()
        count += 1

    print(f"Total: {count} conversion action(s)")


def create_conversion(args):
    """Create a new conversion action."""
    client = get_client()
    conversion_action_service = client.get_service("ConversionActionService")

    operation = client.get_type("ConversionActionOperation")
    action = operation.create

    action.name = args.name
    action.category = getattr(
        client.enums.ConversionActionCategoryEnum.ConversionActionCategory,
        args.category,
    )
    action.type_ = getattr(
        client.enums.ConversionActionTypeEnum.ConversionActionType,
        args.type,
    )
    action.status = client.enums.ConversionActionStatusEnum.ConversionActionStatus.ENABLED

    if args.value is not None:
        action.value_settings.default_value = args.value
        action.value_settings.always_use_default_value = True

    response = conversion_action_service.mutate_conversion_actions(
        customer_id=args.customer_id,
        operations=[operation],
    )

    for result in response.results:
        print(f"Created conversion action: {result.resource_name}")


def get_tag_snippets(args):
    """Get tag snippets for a conversion action."""
    client = get_client()
    ga_service = client.get_service("GoogleAdsService")

    query = f"""
        SELECT
            conversion_action.id,
            conversion_action.name,
            conversion_action.tag_snippets
        FROM conversion_action
        WHERE conversion_action.id = {args.conversion_action_id}
    """

    response = ga_service.search(customer_id=args.customer_id, query=query)

    for row in response:
        ca = row.conversion_action
        print(f"Conversion action: {ca.name} (ID: {ca.id})")
        if ca.tag_snippets:
            for snippet in ca.tag_snippets:
                print(f"\n--- {snippet.type_.name} snippet ---")
                if snippet.global_site_tag:
                    print("Global site tag:")
                    print(snippet.global_site_tag)
                if snippet.event_snippet:
                    print("Event snippet:")
                    print(snippet.event_snippet)
        else:
            print("No tag snippets available for this conversion action.")


def check_status(args):
    """Check conversion tracking status for the customer."""
    client = get_client()
    ga_service = client.get_service("GoogleAdsService")

    query = """
        SELECT
            customer.conversion_tracking_setting.conversion_tracking_id,
            customer.conversion_tracking_setting.conversion_tracking_status,
            customer.conversion_tracking_setting.cross_account_conversion_tracking_id,
            customer.conversion_tracking_setting.accepted_customer_data_terms
        FROM customer
        LIMIT 1
    """

    response = ga_service.search(customer_id=args.customer_id, query=query)

    for row in response:
        cts = row.customer.conversion_tracking_setting
        print(f"Conversion Tracking ID:       {cts.conversion_tracking_id}")
        print(f"Tracking Status:              {cts.conversion_tracking_status.name}")
        print(f"Cross-Account Tracking ID:    {cts.cross_account_conversion_tracking_id}")
        print(f"Accepted Customer Data Terms: {cts.accepted_customer_data_terms}")


def upload_conversion(args):
    """Upload an offline click conversion."""
    client = get_client()
    conversion_upload_service = client.get_service("ConversionUploadService")
    conversion_action_service = client.get_service("ConversionActionService")

    click_conversion = client.get_type("ClickConversion")
    click_conversion.conversion_action = conversion_action_service.conversion_action_path(
        args.customer_id, args.conversion_action_id
    )
    click_conversion.gclid = args.gclid
    click_conversion.conversion_date_time = args.conversion_time
    click_conversion.conversion_value = args.value
    click_conversion.currency_code = args.currency

    response = conversion_upload_service.upload_click_conversions(
        customer_id=args.customer_id,
        conversions=[click_conversion],
        partial_failure=True,
    )

    if response.partial_failure_error:
        print(f"Partial failure: {response.partial_failure_error.message}", file=sys.stderr)
    else:
        for result in response.results:
            print(f"Uploaded conversion: gclid={result.gclid}, action={result.conversion_action}")


def main():
    parser = argparse.ArgumentParser(
        description="Google Ads CLI for managing conversions",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # list-conversions
    p_list = subparsers.add_parser("list-conversions", help="List all conversion actions")
    p_list.add_argument("--customer-id", required=True, help="Google Ads customer ID (no dashes)")
    p_list.set_defaults(func=list_conversions)

    # create-conversion
    p_create = subparsers.add_parser("create-conversion", help="Create a conversion action")
    p_create.add_argument("--customer-id", required=True, help="Google Ads customer ID (no dashes)")
    p_create.add_argument("--name", required=True, help="Conversion action name")
    p_create.add_argument("--category", default="PAGE_VIEW", help="Category (e.g. PAGE_VIEW, PURCHASE)")
    p_create.add_argument("--type", default="WEBPAGE", help="Type (e.g. WEBPAGE, UPLOAD_CLICKS)")
    p_create.add_argument("--value", type=float, default=None, help="Default conversion value")
    p_create.set_defaults(func=create_conversion)

    # get-tag-snippets
    p_tag = subparsers.add_parser("get-tag-snippets", help="Get tag snippets for a conversion action")
    p_tag.add_argument("--customer-id", required=True, help="Google Ads customer ID (no dashes)")
    p_tag.add_argument("--conversion-action-id", required=True, help="Conversion action ID")
    p_tag.set_defaults(func=get_tag_snippets)

    # check-status
    p_status = subparsers.add_parser("check-status", help="Check conversion tracking status")
    p_status.add_argument("--customer-id", required=True, help="Google Ads customer ID (no dashes)")
    p_status.set_defaults(func=check_status)

    # upload-conversion
    p_upload = subparsers.add_parser("upload-conversion", help="Upload an offline click conversion")
    p_upload.add_argument("--customer-id", required=True, help="Google Ads customer ID (no dashes)")
    p_upload.add_argument("--conversion-action-id", required=True, help="Conversion action ID")
    p_upload.add_argument("--gclid", required=True, help="Google click ID")
    p_upload.add_argument("--conversion-time", required=True, help="Conversion time (e.g. 2026-02-18 12:00:00-05:00)")
    p_upload.add_argument("--value", type=float, default=1.0, help="Conversion value (default: 1.0)")
    p_upload.add_argument("--currency", default="USD", help="Currency code (default: USD)")
    p_upload.set_defaults(func=upload_conversion)

    args = parser.parse_args()

    try:
        args.func(args)
    except GoogleAdsException as ex:
        print(f"Google Ads API error: {ex.error.code().name}", file=sys.stderr)
        for error in ex.failure.errors:
            print(f"  {error.message}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
