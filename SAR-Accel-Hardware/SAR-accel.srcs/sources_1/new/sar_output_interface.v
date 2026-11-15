`timescale 1ns/1ps

// One-entry elastic output stage. Enhanced pixels and change bits stay paired
// and stable under backpressure. done pulses when the marked final item is
// accepted by the downstream consumer.
module sar_output_interface (
    input  wire       clk,
    input  wire       rst,
    input  wire [7:0] enhanced_in,
    input  wire       change_in,
    input  wire       last_in,
    input  wire       valid_in,
    output wire       ready_in,
    output reg  [7:0] enhanced_out,
    output reg        change_out,
    output reg        valid_out,
    input  wire       ready_out,
    output reg        done
);
    reg last_reg;
    wire output_transfer;

    // Can accept a new item if empty, or if the current item transfers now.
    assign ready_in = ~valid_out | ready_out;
    assign output_transfer = valid_out && ready_out;

    always @(posedge clk) begin
        if (rst) begin
            enhanced_out <= 8'd0;
            change_out   <= 1'b0;
            valid_out    <= 1'b0;
            last_reg     <= 1'b0;
            done         <= 1'b0;
        end else begin
            done <= output_transfer && last_reg;

            if (ready_in) begin
                valid_out <= valid_in;
                if (valid_in) begin
                    enhanced_out <= enhanced_in;
                    change_out   <= change_in;
                    last_reg     <= last_in;
                end else begin
                    last_reg <= 1'b0;
                end
            end
        end
    end
endmodule
